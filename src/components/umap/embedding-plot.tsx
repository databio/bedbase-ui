import { EmbeddingViewMosaic } from 'embedding-atlas/react';
import { useEffect, useLayoutEffect, useState, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import * as vg from '@uwdata/vgplot';

import { tableau20 } from '../../lib/tableau20';
import { sequentialPalette } from '../../lib/sequential-palette';
import { isIn } from '@uwdata/mosaic-sql';
import { umapSelectParams, pointInPolygonPredicate, boundingRect, type UmapPoint, type ActiveFilter } from '../../lib/umap-utils';
import { AtlasTooltip, tooltipGate } from './atlas-tooltip';
import { useMosaicCoordinator } from '../../contexts/mosaic-coordinator-context';
import { useTab } from '../../contexts/tab-context';

type Props = {
  bedIds?: string[];
  preselectedIds?: string[];
  showStatus?: boolean;
  height?: number;
  customCoordinates?: number[] | null;
  customFilename?: string;
  simpleTooltip?: boolean;
  colorGrouping?: string;
  onLegendItemsChange?: (items: any[]) => void;
  activeFilters: ActiveFilter[];
  // Selection state from parent reducer
  persistentPoints: UmapPoint[];
  interactivePoints: UmapPoint[];
  pendingPoints: UmapPoint[] | null;
  // Selection callbacks to parent reducer
  onPreselectedChange: (points: UmapPoint[]) => void;
  onBucketChange: (points: UmapPoint[]) => void;
  onInteractiveChange: (points: UmapPoint[]) => void;
  onSetPending: (points: UmapPoint[] | null) => void;
  onApplyPending: () => void;
  onPreselectedMatchChange?: (matched: number, total: number) => void;
  highlightPoints?: UmapPoint[];
  highlightRangeSelection?: boolean;
  className?: string;
};

export type EmbeddingPlotRef = {
  centerOnBedId: (bedId: string, scale?: number, reselect?: boolean) => Promise<void>;
  handleFileUpload: () => Promise<void>;
  handleFileRemove: () => Promise<void>;
  queryByCategory: (category: string) => Promise<UmapPoint[]>;
  clearRangeSelection: () => void;
};

export const EmbeddingPlot = forwardRef<EmbeddingPlotRef, Props>((props, ref) => {
  const {
    bedIds,
    preselectedIds,
    showStatus,
    height,
    customCoordinates,
    customFilename,
    simpleTooltip,
    colorGrouping = 'cell_line_category',
    onLegendItemsChange,
    activeFilters,
    persistentPoints,
    interactivePoints,
    pendingPoints,
    onPreselectedChange,
    onBucketChange,
    onInteractiveChange,
    onSetPending,
    onApplyPending,
    onPreselectedMatchChange,
    highlightPoints,
    highlightRangeSelection = true,
    className,
  } = props;

  const { coordinator, initializeData, addCustomPoint, deleteCustomPoint, webglStatus } =
    useMosaicCoordinator();
  const { openTab } = useTab();

  const CONTINUOUS_FIELDS = ['number_of_regions', 'mean_region_width', 'gc_content', 'median_tss_dist'];
  const isContinuous = CONTINUOUS_FIELDS.includes(colorGrouping.replace('_category', ''));

  const containerRef = useRef<HTMLDivElement>(null);

  const [containerWidth, setContainerWidth] = useState(900);
  const [containerHeight, setContainerHeight] = useState(500);
  const [isReady, setIsReady] = useState(false);
  const [tooltipPoint, setTooltipPoint] = useState<any>(null);
  const [viewportState, setViewportState] = useState<any>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [rangeSelectionValue, setRangeSelectionValue] = useState<any>(undefined);
  const [filterTable, setFilterTable] = useState('data');
  // Track whether interactive points came from a range/lasso (large) vs point click (small).
  // Range-selected points are excluded from the selection prop to avoid embedding-atlas
  // rebuilding a massive SQL predicate and rendering 1000+ SVG circles.
  const [isRangeInteraction, setIsRangeInteraction] = useState(false);

  const filter = useMemo(() => vg.Selection.intersect(), []);
  // Single source object for all active filters — predicates are AND'd in JS before updating.
  const filterSourceRef = useRef({});

  // visualSelection: merge persistent + (non-range) interactive + highlight
  // Range-selected points are excluded — they still flow to table/stats via onInteractiveChange
  const visualSelection = useMemo(() => {
    const seen = new Set<string>();
    const merged: UmapPoint[] = [];
    for (const p of persistentPoints) {
      if (!seen.has(p.identifier)) { seen.add(p.identifier); merged.push(p); }
    }
    if (!isRangeInteraction || highlightRangeSelection) {
      for (const p of interactivePoints) {
        if (!seen.has(p.identifier)) { seen.add(p.identifier); merged.push(p); }
      }
    }
    for (const p of (highlightPoints || [])) {
      if (!seen.has(p.identifier)) { seen.add(p.identifier); merged.push(p); }
    }
    return merged;
  }, [persistentPoints, interactivePoints, highlightPoints, isRangeInteraction, highlightRangeSelection]);

  // Suppress hover tooltips when nothing is selected
  useLayoutEffect(() => {
    tooltipGate.enabled = visualSelection.length > 0;
  }, [visualSelection.length]);

  const centerOnPoint = (point: any, scale?: number, tooltip = true) => {
    if (tooltip) {
      setTooltipPoint(null);
      setTimeout(() => setTooltipPoint(point), 300);
    }
    if (scale != null) {
      setViewportState({ x: point.x, y: point.y, scale });
    } else {
      setViewportState((prev: any) => ({ ...prev, x: point.x, y: point.y }));
    }
  };

  const queryPoints = async (ids: string[]): Promise<UmapPoint[]> => {
    if (ids.length === 0) return [];
    const q = vg.Query.from(filterTable)
      .select(umapSelectParams(colorGrouping))
      .where(isIn(vg.column('id'), ids.map((id) => vg.literal(id))));
    const result: any = await coordinator.query(q, { type: 'json' });
    return result || [];
  };

  const centerOnBedId = async (bedId: string, scale?: number, reselect = false) => {
    if (!isReady) return;
    const points = await queryPoints([bedId]);
    if (points.length > 0) {
      centerOnPoint(points[0], scale, true);
      if (reselect) onInteractiveChange([points[0]]);
    }
  };

  // Post-remount action (e.g., center on custom point after file upload)
  const postRemountRef = useRef<(() => void) | null>(null);

  const handleFileUpload = async () => {
    try {
      if (customCoordinates && customCoordinates.length >= 2) {
        await addCustomPoint(customCoordinates[0], customCoordinates[1], customFilename);
        coordinator.clear();
        const updatedLegend = await fetchLegendItems(coordinator);
        onLegendItemsChange?.(updatedLegend);
        // Schedule post-remount action, then trigger remount
        postRemountRef.current = async () => {
          const points = await queryPoints(['custom_point']);
          if (points.length > 0) {
            centerOnPoint(points[0], 0.2, true);
            onInteractiveChange([points[0]]);
          }
        };
        setDataVersion((v) => v + 1);
      }
    } catch (error) {
      console.error('Error getting UMAP coordinates:', error);
    }
  };

  const handleFileRemove = async () => {
    try {
      await deleteCustomPoint();
      coordinator.clear();
      const updatedLegend = await fetchLegendItems(coordinator);
      onLegendItemsChange?.(updatedLegend);
      const newSelection = interactivePoints.filter((p) => p.identifier !== 'custom_point');
      onSetPending(newSelection);
      setDataVersion((v) => v + 1);
    } catch (error) {
      console.error('Error removing file:', error);
    }
  };

  const OTHER_CATEGORY = 18;
  const UPLOADED_CATEGORY = 19;

  const fetchLegendItems = async (coord: any) => {
    const colName = colorGrouping.replace('_category', '');

    // Check if this is a continuous (binned) field by seeing if the source column is numeric
    const isContinuous = ['number_of_regions', 'mean_region_width', 'gc_content', 'median_tss_dist'].includes(colName);

    let q;
    if (isContinuous) {
      // Always query from `data` (not filtered view) so legend shows all categories
      q = vg.Query.from('data')
        .select({
          min_val: vg.sql`MIN(${vg.column(colName)})`,
          max_val: vg.sql`MAX(${vg.column(colName)})`,
          category: vg.column(colorGrouping),
        })
        .groupby(vg.column(colorGrouping))
        .orderby(vg.column(colorGrouping));

      const rawItems = (await coord.query(q, { type: 'json' })) as any[];

      // Determine label precision from the overall data range and bin count
      const dataBins = rawItems.filter(
        (r) => r.category !== OTHER_CATEGORY && r.category !== UPLOADED_CATEGORY && r.min_val != null,
      );
      let precision = 1;
      if (dataBins.length > 1) {
        const overallMin = Math.min(...dataBins.map((r) => r.min_val));
        const overallMax = Math.max(...dataBins.map((r) => r.max_val));
        const range = overallMax - overallMin;
        precision = range > 0
          ? Math.max(0, Math.ceil(-Math.log10(range / dataBins.length)))
          : 1;
      }
      const fmt = (v: number) => {
        const s = v.toFixed(precision);
        // Strip unnecessary trailing zeros after decimal point but keep at least one
        return precision > 0 ? s.replace(/0+$/, '0').replace(/\.0$/, '') : s;
      };

      return rawItems.map((r) => ({
        category: r.category,
        name:
          r.category === UPLOADED_CATEGORY ? 'Uploaded BED'
          : r.category === OTHER_CATEGORY ? 'N/A'
          : `${fmt(r.min_val)} - ${fmt(r.max_val)}`,
      }));
    } else {
      q = vg.Query.from('data')
        .select({
          name: vg.sql`CASE
            WHEN ${vg.column(colorGrouping)} = ${UPLOADED_CATEGORY} THEN 'Uploaded BED'
            WHEN ${vg.column(colorGrouping)} = ${OTHER_CATEGORY} THEN 'Other'
            ELSE MIN(${vg.column(colName)})
          END`,
          category: vg.column(colorGrouping),
        })
        .groupby(vg.column(colorGrouping))
        .orderby(vg.column(colorGrouping));
    }

    return (await coord.query(q, { type: 'json' })) as any[];
  };

  const queryByCategory = async (category: string): Promise<UmapPoint[]> => {
    const q = vg.Query.from(filterTable)
      .select(umapSelectParams(colorGrouping))
      .where(vg.eq(vg.column(colorGrouping), vg.literal(Number(category))));
    const result: any = await coordinator.query(q, { type: 'json' });
    return result || [];
  };

  // Rebuild Mosaic filter whenever activeFilters change.
  // Uses the same single-source pattern as the original legend pin filter.
  // Only filters for the CURRENT variable go through the Mosaic filter (embedding-atlas
  // doesn't support multi-column predicates). Cross-variable filters are applied by
  // physically filtering the DuckDB table and remounting the component.
  const prevFiltersRef = useRef<string>('');
  useEffect(() => {
    const source = filterSourceRef.current;

    // Current variable's filters → Mosaic filter predicate (immediate, no remount)
    const currentCats = activeFilters
      .filter((f) => f.variable === colorGrouping)
      .map((f) => f.categoryValue);

    if (currentCats.length === 0) {
      filter.update({ source, value: null, predicate: null });
    } else if (currentCats.length === 1) {
      filter.update({ source, value: currentCats[0], predicate: vg.eq(colorGrouping, currentCats[0]) });
    } else {
      filter.update({
        source,
        value: currentCats,
        predicate: isIn(vg.column(colorGrouping), currentCats.map((c) => vg.literal(c))),
      });
    }

    // Cross-variable filters → DuckDB VIEW + remount.
    // The `data` table is NEVER modified. A view `_data_filtered` is created on top
    // of it, and the EmbeddingViewMosaic table prop switches between them.
    const crossFilters = activeFilters.filter((f) => f.variable !== colorGrouping);
    const crossKey = crossFilters.map((f) => `${f.variable}:${f.categoryValue}`).sort().join(',');

    if (crossKey !== prevFiltersRef.current) {
      prevFiltersRef.current = crossKey;

      const applyCross = async () => {
        try {
          if (crossFilters.length > 0) {
            const byVariable = new Map<string, number[]>();
            for (const f of crossFilters) {
              const arr = byVariable.get(f.variable) || [];
              arr.push(f.categoryValue);
              byVariable.set(f.variable, arr);
            }
            const conditions = [...byVariable.entries()].map(([variable, cats]) =>
              cats.length === 1
                ? `"${variable}" = ${cats[0]}`
                : `"${variable}" IN (${cats.join(', ')})`,
            );
            const where = conditions.join(' AND ');
            await coordinator.exec([
              `CREATE OR REPLACE VIEW _data_filtered AS SELECT * FROM data WHERE ${where}`,
            ]);
            setFilterTable('_data_filtered');
          } else {
            setFilterTable('data');
          }
          setDataVersion((v) => v + 1);
        } catch (e) {
          console.error('Cross-variable filter failed:', e);
        }
      };

      applyCross();
    }

    setRangeSelectionValue(null);
    onInteractiveChange([]);
  }, [activeFilters, colorGrouping]);

  const handlePointSelection = (dataPoints: any[] | null) => {
    setIsRangeInteraction(false);
    if (!dataPoints || dataPoints.length === 0) {
      onInteractiveChange([]);
      return;
    }
    onInteractiveChange(dataPoints.filter((p) => p != null));
  };

  const handleRangeSelection = async (coord: any, value: any) => {
    if (!value) return;

    let predicate: any;
    // Build filter predicates from all active filters (not just current variable)
    const byVariable = new Map<string, number[]>();
    for (const f of activeFilters) {
      const arr = byVariable.get(f.variable) || [];
      arr.push(f.categoryValue);
      byVariable.set(f.variable, arr);
    }
    const filterPredicates = [...byVariable.entries()].map(([variable, cats]) =>
      cats.length === 1
        ? vg.eq(vg.column(variable), vg.literal(cats[0]))
        : isIn(vg.column(variable), cats.map((c) => vg.literal(c))),
    );

    if (typeof value === 'object' && 'xMin' in value) {
      // Rectangle selection
      predicate = vg.and(
        vg.isBetween(vg.column('x'), [value.xMin, value.xMax]),
        vg.isBetween(vg.column('y'), [value.yMin, value.yMax]),
        ...filterPredicates,
      );
    } else if (Array.isArray(value) && value.length >= 3) {
      // Polygon/lasso selection
      const bounds = boundingRect(value);
      predicate = vg.and(
        vg.isBetween(vg.column('x'), [bounds.xMin, bounds.xMax]),
        vg.isBetween(vg.column('y'), [bounds.yMin, bounds.yMax]),
        pointInPolygonPredicate(vg.column('x'), vg.column('y'), value),
        ...filterPredicates,
      );
    }

    if (!predicate) return;

    const selectParams = highlightRangeSelection
      ? umapSelectParams(colorGrouping)
      : { identifier: vg.column('id'), category: vg.column(colorGrouping) };
    const q = vg.Query.from(filterTable).select(selectParams).where(predicate);
    const result = (await coord.query(q, { type: 'json' })) as any[];

    setIsRangeInteraction(true);
    onInteractiveChange(result || []);
  };

  // After dataVersion change (remount): apply pending selection and post-remount action
  // Uses setTimeout to wait for the remounted EmbeddingViewMosaic to initialize
  useEffect(() => {
    if (pendingPoints !== null) {
      setTimeout(() => onApplyPending(), 200);
    }
    if (postRemountRef.current) {
      const fn = postRemountRef.current;
      postRemountRef.current = null;
      setTimeout(() => fn(), 200);
    }
  }, [dataVersion]);

  // Track initial customCoordinates to distinguish "new upload" from "remount with existing"
  const initialCoordinatesRef = useRef(customCoordinates);
  useEffect(() => {
    if (!customCoordinates) {
      // Reset ref when coordinates are cleared (e.g., visibility toggle off)
      // so re-showing the same coordinates triggers a re-add
      initialCoordinatesRef.current = null;
      return;
    }
    // Skip if coordinates were already present on mount (init effect handled it)
    if (initialCoordinatesRef.current && customCoordinates === initialCoordinatesRef.current) return;
    if (isReady && pendingPoints === null) {
      handleFileUpload();
    }
  }, [customCoordinates, isReady]);

  // No need to clear pins on colorGrouping change — pinnedCategories is now derived
  // from activeFilters, and the filter rebuild effect handles predicate updates.

  useEffect(() => {
    if (isReady) {
      fetchLegendItems(coordinator).then((result) => onLegendItemsChange?.(result));
    }
  }, [isReady, colorGrouping, onLegendItemsChange]);

  useEffect(() => {
    initializeData().then(async () => {
      if (customCoordinates) {
        await addCustomPoint(customCoordinates[0], customCoordinates[1], customFilename);
        coordinator.clear();
      }
      setIsReady(true);
    });
  }, []);

  // Preselection: URL param IDs only — sticky, center if single
  useEffect(() => {
    if (!isReady || !preselectedIds || preselectedIds.length === 0) {
      onPreselectedChange([]);
      onPreselectedMatchChange?.(0, 0);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const points = await queryPoints(preselectedIds);
      if (cancelled) return;
      onPreselectedMatchChange?.(points?.length ?? 0, preselectedIds.length);
      if (!points || points.length === 0) {
        onPreselectedChange([]);
        return;
      }
      onPreselectedChange(points);
      if (points.length === 1) {
        centerOnPoint(points[0], 0.2, true);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [isReady, preselectedIds, coordinator, colorGrouping]);

  // Bucket IDs (non-preselected): query and set as persistent
  useEffect(() => {
    if (!isReady) return;

    const preselectedSet = new Set(preselectedIds || []);
    const bucketOnlyIds = (bedIds || []).filter((id) => !preselectedSet.has(id));

    if (bucketOnlyIds.length === 0) {
      onBucketChange([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      const bucketPoints = await queryPoints(bucketOnlyIds);
      if (cancelled) return;
      onBucketChange(bucketPoints || []);
    };
    run();
    return () => { cancelled = true; };
  }, [isReady, bedIds, coordinator, colorGrouping]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [isReady]);

  useImperativeHandle(
    ref,
    () => ({
      centerOnBedId,
      handleFileUpload,
      handleFileRemove,
      queryByCategory,
      clearRangeSelection: () => setRangeSelectionValue(null),
    }),
    [colorGrouping, interactivePoints],
  );

  if (webglStatus.error) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-base-100 ${className || ''}`}
        style={{ height: height || 500 }}
      >
        <span className="text-base-content/50 text-sm">{webglStatus.error}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className || ''}`} style={height ? { height } : { flex: 1, minHeight: 0 }}>
      {isReady ? (
        <EmbeddingViewMosaic
          key={`embedding-${dataVersion}`}
          coordinator={coordinator}
          table={filterTable}
          x="x"
          y="y"
          identifier="id"
          text="name"
          category={colorGrouping}
          categoryColors={isContinuous ? sequentialPalette : tableau20}
          additionalFields={{
            Description: 'description',
            Assay: 'assay',
            Target: 'target',
            'Cell Line': 'cell_line',
            'Cell Type': 'cell_type',
            Tissue: 'tissue',
            Regions: 'number_of_regions',
            'Mean Width': 'mean_region_width',
          }}
          height={height || containerHeight}
          width={containerWidth}
          config={{ autoLabelEnabled: false }}
          filter={filter}
          viewportState={viewportState}
          onViewportState={setViewportState}
          tooltip={tooltipPoint}
          onTooltip={setTooltipPoint}
          customTooltip={{
            class: AtlasTooltip,
            props: {
              showLink: true,
              simpleTooltip,
              onNavigate: (id: string) => openTab('analysis', 'bed/' + id),
            },
          }}
          selection={visualSelection as any}
          onSelection={handlePointSelection}
          rangeSelectionValue={rangeSelectionValue}
          onRangeSelection={(e: any) => {
            setRangeSelectionValue(e);
            handleRangeSelection(coordinator, e);
          }}
          theme={{ statusBar: showStatus }}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      )}
    </div>
  );
});
