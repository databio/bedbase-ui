import { createContext, useContext, useMemo, useRef, useState, useEffect, type ReactNode } from 'react';
import * as vg from '@uwdata/vgplot';
import { UMAP_URL } from '../lib/umap-utils';

type MosaicCoordinatorContextValue = {
  getCoordinator: () => vg.Coordinator;
  initializeData: () => Promise<void>;
  addCustomPoint: (x: number, y: number, description?: string) => Promise<void>;
  deleteCustomPoint: () => Promise<void>;
  webglStatus: { checking: boolean; webgl2: boolean; error: string | null };
  umapBedIds: Set<string>;
};

const MosaicCoordinatorContext = createContext<MosaicCoordinatorContextValue | null>(null);

export function MosaicCoordinatorProvider({ children }: { children: ReactNode }) {
  const coordinatorRef = useRef<vg.Coordinator | null>(null);
  const dataInitializedRef = useRef(false);
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
      // Load raw data
      vg.sql`CREATE OR REPLACE TABLE data AS
        SELECT unnest(nodes, recursive := true)
        FROM read_json_auto('${UMAP_URL}')`,
      // Rank assays by frequency, cap at top N, rest = OTHER_CATEGORY
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

    dataInitializedRef.current = true;

    // Build the ID lookup set
    const ids: any = await coordinator.query('SELECT id FROM data', { type: 'json' });
    if (ids && ids.length > 0) {
      setUmapBedIds(new Set(ids.map((row: any) => row.id)));
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
      vg.sql`INSERT INTO data VALUES (
        ${x}, ${y}, 'custom_point', 'Your uploaded file', '${description}',
        'Uploaded BED', 'Uploaded BED', ${UPLOADED_CATEGORY}, ${UPLOADED_CATEGORY}
      )` as any,
    ]);
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
    () => ({ getCoordinator, initializeData, addCustomPoint, deleteCustomPoint, webglStatus, umapBedIds }),
    [webglStatus, umapBedIds],
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
    webglStatus: context.webglStatus,
    umapBedIds: context.umapBedIds,
  };
}
