import { createContext, useContext, useMemo, useRef, useState, useEffect, type ReactNode } from 'react';
import * as vg from '@uwdata/vgplot';
import { GEOMETRY_URL, META_T1_URL, META_T2_URL } from '../lib/umap-utils';

type MosaicCoordinatorContextValue = {
  getCoordinator: () => vg.Coordinator;
  initializeData: () => Promise<void>;
  addCustomPoint: (x: number, y: number, description?: string) => Promise<void>;
  deleteCustomPoint: () => Promise<void>;
  ensureGrouping: (key: string) => Promise<void>;
  loadTier2: () => Promise<void>;
  tier2Loaded: boolean;
  tier2Loading: boolean;
  webglStatus: { checking: boolean; webgl2: boolean; error: string | null };
  umapBedIds: Set<string>;
};

const MosaicCoordinatorContext = createContext<MosaicCoordinatorContextValue | null>(null);

/** Number of quantile bins for continuous fields (matches palette slots 0-17) */
const NUM_BINS = 18;

/** Fields that require quantile binning */
const CONTINUOUS_SOURCES: Record<string, string> = {
  number_of_regions_category: 'number_of_regions',
  mean_region_width_category: 'mean_region_width',
  gc_content_category: 'gc_content',
  median_tss_dist_category: 'median_tss_dist',
};

/** Categorical fields that need top-N ranking (column name -> category column) */
const CATEGORICAL_RANKINGS: Record<string, string> = {
  cell_line_category: 'cell_line',
  assay_category: 'assay',
  target_category: 'target',
  tissue_category: 'tissue',
  cell_type_category: 'cell_type',
  species_name_category: 'species_name',
  data_format_category: 'data_format',
  treatment_category: 'treatment',
  antibody_category: 'antibody',
};

export function MosaicCoordinatorProvider({ children }: { children: ReactNode }) {
  const coordinatorRef = useRef<vg.Coordinator | null>(null);
  const dataInitializedRef = useRef(false);
  const createdGroupings = useRef<Set<string>>(new Set());
  const [tier2Loaded, setTier2Loaded] = useState(false);
  const [tier2Loading, setTier2Loading] = useState(false);
  const [webglStatus, setWebglStatus] = useState<{
    checking: boolean;
    webgl2: boolean;
    error: string | null;
  }>({ checking: true, webgl2: false, error: null });
  const [umapBedIds, setUmapBedIds] = useState<Set<string>>(new Set());

  const getCoordinator = () => {
    if (!coordinatorRef.current) {
      coordinatorRef.current = new vg.Coordinator(vg.wasmConnector());
    }
    return coordinatorRef.current;
  };

  // Top 18 categories get unique colors (0-17), everything else is "Other" (18),
  // and uploaded files are always category 19.
  const TOP_N = 18;
  const OTHER_CATEGORY = TOP_N;     // 18
  const UPLOADED_CATEGORY = TOP_N + 1; // 19

  const initializeData = async () => {
    if (dataInitializedRef.current) return;

    const coordinator = getCoordinator();
    await coordinator.exec([
      // Load geometry + tier 1 metadata from Parquet, join on id
      // Replace empty strings with 'UNKNOWN' for categorical columns used in legend
      vg.sql`CREATE OR REPLACE TABLE data AS
        SELECT g.*,
          m.name, m.description, m.number_of_regions, m.mean_region_width, m.gc_content,
          CASE WHEN m.assay = '' THEN 'UNKNOWN' ELSE m.assay END AS assay,
          CASE WHEN m.cell_line = '' THEN 'UNKNOWN' ELSE m.cell_line END AS cell_line,
          CASE WHEN m.cell_type = '' THEN 'UNKNOWN' ELSE m.cell_type END AS cell_type,
          CASE WHEN m.target = '' THEN 'UNKNOWN' ELSE m.target END AS target,
          CASE WHEN m.tissue = '' THEN 'UNKNOWN' ELSE m.tissue END AS tissue
        FROM read_parquet('${GEOMETRY_URL}') g
        JOIN read_parquet('${META_T1_URL}') m ON g.id = m.id`,
      // Compute default category rankings (cell_line, assay)
      vg.sql`CREATE OR REPLACE TABLE data AS
        WITH assay_ranks AS (
          SELECT assay, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, assay) - 1 AS rank
          FROM data GROUP BY assay
        ),
        cell_line_ranks AS (
          SELECT cell_line, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, cell_line) - 1 AS rank
          FROM data GROUP BY cell_line
        )
        SELECT d.*,
          CASE WHEN ar.rank < ${TOP_N} THEN ar.rank::INTEGER ELSE ${OTHER_CATEGORY}::INTEGER END AS assay_category,
          CASE WHEN cr.rank < ${TOP_N} THEN cr.rank::INTEGER ELSE ${OTHER_CATEGORY}::INTEGER END AS cell_line_category
        FROM data d
        JOIN assay_ranks ar ON d.assay = ar.assay
        JOIN cell_line_ranks cr ON d.cell_line = cr.cell_line` as any,
    ]);

    createdGroupings.current.add('assay_category');
    createdGroupings.current.add('cell_line_category');
    dataInitializedRef.current = true;

    // Build the ID lookup set
    const ids: any = await coordinator.query('SELECT id FROM data', { type: 'json' });
    if (ids && ids.length > 0) {
      setUmapBedIds(new Set(ids.map((row: any) => row.id)));
    }
  };

  /** Ensure a grouping column exists in the data table. Creates it on demand. */
  const ensureGrouping = async (key: string) => {
    if (createdGroupings.current.has(key)) return;

    const coordinator = getCoordinator();

    // Continuous: quantile binning with adaptive bin count
    const sourceCol = CONTINUOUS_SOURCES[key];
    if (sourceCol) {
      // Compute quantile boundaries individually to avoid DuckDB list type issues
      const percentiles = Array.from({ length: NUM_BINS - 1 }, (_, i) => (i + 1) / NUM_BINS);
      const selectCols = percentiles.map(
        (p, i) => `quantile_cont(${sourceCol}, ${p.toFixed(6)}) AS q${i}`,
      ).join(', ');
      const boundaries: any = await coordinator.query(
        `SELECT ${selectCols} FROM data WHERE ${sourceCol} IS NOT NULL`,
        { type: 'json' },
      );
      const row = boundaries?.[0];
      if (!row) {
        await coordinator.exec([
          `ALTER TABLE data ADD COLUMN IF NOT EXISTS "${key}" INTEGER DEFAULT ${OTHER_CATEGORY}`,
        ]);
        createdGroupings.current.add(key);
        return;
      }
      const rawQuantiles: number[] = percentiles.map((_, i) => row[`q${i}`]).filter((v) => v != null);
      if (rawQuantiles.length === 0) {
        await coordinator.exec([
          `ALTER TABLE data ADD COLUMN IF NOT EXISTS "${key}" INTEGER DEFAULT ${OTHER_CATEGORY}`,
        ]);
        createdGroupings.current.add(key);
        return;
      }

      // Deduplicate boundaries that are too close together (e.g., GC content
      // where quantile values are technically distinct but represent the same region).
      // Tolerance: 1/10 of the ideal bin width across the data range.
      const qRange = rawQuantiles[rawQuantiles.length - 1] - rawQuantiles[0];
      const tolerance = qRange > 0 ? qRange / (NUM_BINS * 10) : 0;
      const deduped: number[] = [rawQuantiles[0]];
      for (let i = 1; i < rawQuantiles.length; i++) {
        if (rawQuantiles[i] - deduped[deduped.length - 1] > tolerance) {
          deduped.push(rawQuantiles[i]);
        }
      }

      // Map reduced bin indices to spread across the 18-slot palette for visual continuity.
      // actualBins = deduped.length + 1 (one bin per boundary gap, plus one beyond the last).
      const actualBins = deduped.length + 1;
      const mapIndex = (bin: number) =>
        actualBins >= NUM_BINS
          ? bin
          : actualBins <= 1
            ? 0
            : Math.round((bin / (actualBins - 1)) * (NUM_BINS - 1));

      // Build CASE expression for bin assignment using palette-mapped indices
      const cases: string[] = deduped.map(
        (q, i) => `WHEN ${sourceCol} <= ${q} THEN ${mapIndex(i)}`,
      );
      cases.push(`ELSE ${mapIndex(actualBins - 1)}`);
      const caseExpr = `CASE WHEN ${sourceCol} IS NULL THEN ${OTHER_CATEGORY} ${cases.join(' ')} END`;

      await coordinator.exec([
        `ALTER TABLE data ADD COLUMN IF NOT EXISTS "${key}" INTEGER`,
        `UPDATE data SET "${key}" = (${caseExpr})`,
        // Ensure uploaded file always gets the dedicated indicator
        `UPDATE data SET "${key}" = ${UPLOADED_CATEGORY} WHERE id = 'custom_point'`,
      ]);

      createdGroupings.current.add(key);
      return;
    }

    // Categorical: top-N ranking
    const catCol = CATEGORICAL_RANKINGS[key];
    if (catCol) {
      // Compute ranks in a temp table, then ALTER + UPDATE to preserve existing columns
      await coordinator.exec([
        `CREATE OR REPLACE TEMP TABLE _ranks AS
          SELECT "${catCol}", (ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, "${catCol}") - 1)::INTEGER AS rank
          FROM data GROUP BY "${catCol}"`,
        `ALTER TABLE data ADD COLUMN IF NOT EXISTS "${key}" INTEGER`,
        `UPDATE data SET "${key}" = CASE
          WHEN _r.rank < ${TOP_N} THEN _r.rank ELSE ${OTHER_CATEGORY}
          END FROM _ranks _r WHERE data."${catCol}" = _r."${catCol}"`,
        // Ensure uploaded file always gets the dedicated indicator
        `UPDATE data SET "${key}" = ${UPLOADED_CATEGORY} WHERE id = 'custom_point'`,
        `DROP TABLE IF EXISTS _ranks`,
      ]);
      createdGroupings.current.add(key);
    }
  };

  /** Load tier 2 metadata and join into the data table */
  const loadTier2 = async () => {
    if (tier2Loaded || tier2Loading) return;
    setTier2Loading(true);

    try {
      const coordinator = getCoordinator();
      await coordinator.exec([
        vg.sql`CREATE OR REPLACE TABLE data AS
          SELECT d.*,
            CASE WHEN t2.treatment = '' OR t2.treatment IS NULL THEN 'UNKNOWN' ELSE t2.treatment END AS treatment,
            CASE WHEN t2.antibody = '' OR t2.antibody IS NULL THEN 'UNKNOWN' ELSE t2.antibody END AS antibody,
            CASE WHEN t2.species_name = '' OR t2.species_name IS NULL THEN 'UNKNOWN' ELSE t2.species_name END AS species_name,
            COALESCE(t2.genome_alias, 'UNKNOWN') AS genome_alias,
            COALESCE(t2.bed_compliance, '') AS bed_compliance,
            COALESCE(t2.data_format, '') AS data_format,
            t2.median_tss_dist,
            COALESCE(t2.library_source, '') AS library_source,
            COALESCE(t2.global_sample_id, '') AS global_sample_id,
            COALESCE(t2.global_experiment_id, '') AS global_experiment_id,
            COALESCE(t2.original_file_name, '') AS original_file_name
          FROM data d
          LEFT JOIN read_parquet('${META_T2_URL}') t2 ON d.id = t2.id` as any,
      ]);
      setTier2Loaded(true);
    } catch (e) {
      console.error('Failed to load tier 2 metadata:', e);
    } finally {
      setTier2Loading(false);
    }
  };

  const deleteCustomPoint = async () => {
    const coordinator = getCoordinator();
    await coordinator.exec([vg.sql`DELETE FROM data WHERE id = 'custom_point'` as any]);
  };

  const addCustomPoint = async (x: number, y: number, description = 'User uploaded BED file') => {
    const coordinator = getCoordinator();
    await coordinator.exec([vg.sql`DELETE FROM data WHERE id = 'custom_point'` as any]);

    await coordinator.exec([
      vg.sql`INSERT INTO data (x, y, id, name, description, assay, cell_line, cell_type, tissue, target,
        number_of_regions, mean_region_width, gc_content,
        assay_category, cell_line_category)
      VALUES (
        ${x}, ${y}, 'custom_point', 'Your uploaded file', '${description}',
        'Uploaded BED', 'Uploaded BED', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN',
        NULL, NULL, NULL,
        ${UPLOADED_CATEGORY}, ${UPLOADED_CATEGORY}
      )` as any,
    ]);

    // Set UPLOADED_CATEGORY for all lazily-created grouping columns
    for (const groupKey of createdGroupings.current) {
      if (groupKey === 'assay_category' || groupKey === 'cell_line_category') continue;
      await coordinator.exec([
        `UPDATE data SET "${groupKey}" = ${UPLOADED_CATEGORY} WHERE id = 'custom_point'`,
      ]);
    }
  };

  // Eagerly initialize data in the background so ID lookups work before UMAP tab opens
  useEffect(() => {
    initializeData().catch(() => {});
  }, []);

  useEffect(() => {
    const checkGraphicsSupport = async () => {
      let webgpuAvailable = false;
      let webgl2Available = false;

      if ('gpu' in navigator) {
        try {
          const adapter = await (navigator as any).gpu.requestAdapter();
          webgpuAvailable = !!adapter;
        } catch {
          webgpuAvailable = false;
        }
      }

      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      webgl2Available = !!gl;
      if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();

      // Force WebGL by hiding WebGPU if not available
      if (!webgpuAvailable && webgl2Available) {
        if ('gpu' in navigator) {
          Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true });
        }
      }

      if (!webgpuAvailable && !webgl2Available) {
        setWebglStatus({
          checking: false,
          webgl2: false,
          error: 'WebGL2 is unavailable. Please enable it or use a different browser to view the UMAP.',
        });
      } else {
        setWebglStatus({ checking: false, webgl2: webgl2Available, error: null });
      }
    };

    checkGraphicsSupport();
  }, []);

  const value = useMemo(
    () => ({
      getCoordinator,
      initializeData,
      addCustomPoint,
      deleteCustomPoint,
      ensureGrouping,
      loadTier2,
      tier2Loaded,
      tier2Loading,
      webglStatus,
      umapBedIds,
    }),
    [webglStatus, umapBedIds, tier2Loaded, tier2Loading],
  );

  return (
    <MosaicCoordinatorContext.Provider value={value}>
      {children}
    </MosaicCoordinatorContext.Provider>
  );
}

export function useMosaicCoordinator() {
  const context = useContext(MosaicCoordinatorContext);
  if (!context) throw new Error('useMosaicCoordinator must be used within MosaicCoordinatorProvider');
  return {
    coordinator: context.getCoordinator(),
    initializeData: context.initializeData,
    addCustomPoint: context.addCustomPoint,
    deleteCustomPoint: context.deleteCustomPoint,
    ensureGrouping: context.ensureGrouping,
    loadTier2: context.loadTier2,
    tier2Loaded: context.tier2Loaded,
    tier2Loading: context.tier2Loading,
    webglStatus: context.webglStatus,
    umapBedIds: context.umapBedIds,
  };
}
