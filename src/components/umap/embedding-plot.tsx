import { EmbeddingViewMosaic } from 'embedding-atlas/react';
import { useEffect, useState, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import * as vg from '@uwdata/vgplot';

import { tableau20 } from '../../lib/tableau20';
import { isIn } from '@uwdata/mosaic-sql';
import { umapSelectParams, pointInPolygonPredicate, boundingRect, type UmapPoint } from '../../lib/umap-utils';
import { AtlasTooltip } from './atlas-tooltip';
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
  pinnedCategories: number[];
  onPinnedCategoriesChange: (categories: number[]) => void;
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
  handleTogglePin: (category: number) => void;
  handlePinAll: (categories: number[]) => void;
  handleUnpinAll: () => void;
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
    pinnedCategories,
    onPinnedCategoriesChange,
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

  const containerRef = useRef<HTMLDivElement>(null);

  const [containerWidth, setContainerWidth] = useState(900);
  const [containerHeight, setContainerHeight] = useState(500);
  const [isReady, setIsReady] = useState(false);
  const [tooltipPoint, setTooltipPoint] = useState<any>(null);
  const [viewportState, setViewportState] = useState<any>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [rangeSelectionValue, setRangeSelectionValue] = useState<any>(undefined);
  // Track whether interactive points came from a range/lasso (large) vs point click (small).
  // Range-selected points are excluded from the selection prop to avoid embedding-atlas
  // rebuilding a massive SQL predicate and rendering 1000+ SVG circles.
  const [isRangeInteraction, setIsRangeInteraction] = useState(false);

  const filter = useMemo(() => vg.Selection.intersect(), []);
  const legendFilterSource = useMemo(() => ({}), []);

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

  const centerOnPoint = (point: any, scale = 0.2, tooltip = true) => {
    if (tooltip) {
      setTooltipPoint(null);
      setTimeout(() => setTooltipPoint(point), 300);
    }
    setViewportState({ x: point.x, y: point.y, scale });
  };

  const queryPoints = async (ids: string[]): Promise<UmapPoint[]> => {
    if (ids.length === 0) return [];
    const q = vg.Query.from('data')
      .select(umapSelectParams(colorGrouping))
      .where(isIn(vg.column('id'), ids.map((id) => vg.literal(id))));
    const result: any = await coordinator.query(q, { type: 'json' });
    return result || [];
  };

  const centerOnBedId = async (bedId: string, scale = 0.2, reselect = false) => {
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
    const q = vg.Query.from('data')
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
    return (await coord.query(q, { type: 'json' })) as any[];
  };

  const queryByCategory = async (category: string): Promise<UmapPoint[]> => {
    const q = vg.Query.from('data')
      .select(umapSelectParams(colorGrouping))
      .where(vg.eq(vg.column(colorGrouping), vg.literal(Number(category))));
    const result: any = await coordinator.query(q, { type: 'json' });
    return result || [];
  };

  const handleTogglePin = (category: number) => {
    setRangeSelectionValue(null);
    onInteractiveChange([]);
    const isPinned = pinnedCategories.includes(category);
    const next = isPinned
      ? pinnedCategories.filter((c) => c !== category)
      : [...pinnedCategories, category];
    onPinnedCategoriesChange(next);
    if (next.length === 0) {
      filter.update({ source: legendFilterSource, value: null, predicate: null });
    } else if (next.length === 1) {
      filter.update({
        source: legendFilterSource,
        value: next[0],
        predicate: vg.eq(colorGrouping, next[0]),
      });
    } else {
      filter.update({
        source: legendFilterSource,
        value: next,
        predicate: isIn(vg.column(colorGrouping), next.map((c) => vg.literal(c))),
      });
    }
  };

  const handlePinAll = (categories: number[]) => {
    setRangeSelectionValue(null);
    onInteractiveChange([]);
    onPinnedCategoriesChange(categories);
    filter.update({
      source: legendFilterSource,
      value: categories,
      predicate: isIn(vg.column(colorGrouping), categories.map((c) => vg.literal(c))),
    });
  };

  const handleUnpinAll = () => {
    setRangeSelectionValue(null);
    onInteractiveChange([]);
    onPinnedCategoriesChange([]);
    filter.update({ source: legendFilterSource, value: null, predicate: null });
  };

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
    const filterPredicates = pinnedCategories.length > 0
      ? [pinnedCategories.length === 1
          ? vg.eq(vg.column(colorGrouping), vg.literal(pinnedCategories[0]))
          : isIn(vg.column(colorGrouping), pinnedCategories.map((c) => vg.literal(c)))]
      : [];

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
    const q = vg.Query.from('data').select(selectParams).where(predicate);
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
    // Skip if coordinates were already present on mount (init effect handled it)
    if (initialCoordinatesRef.current && customCoordinates === initialCoordinatesRef.current) return;
    if (isReady && customCoordinates && pendingPoints === null) {
      handleFileUpload();
    }
  }, [customCoordinates, isReady]);

  useEffect(() => {
    onPinnedCategoriesChange([]);
    filter.update({ source: legendFilterSource, value: null, predicate: null });
  }, [colorGrouping]);

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
      handleTogglePin,
      handlePinAll,
      handleUnpinAll,
      queryByCategory,
      clearRangeSelection: () => setRangeSelectionValue(null),
    }),
    [pinnedCategories, colorGrouping, interactivePoints],
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
          table="data"
          x="x"
          y="y"
          identifier="id"
          text="name"
          category={colorGrouping}
          categoryColors={tableau20}
          additionalFields={{
            Description: 'description',
            Assay: 'assay',
            'Cell Line': 'cell_line',
          }}
          height={height || containerHeight}
          width={containerWidth}
          config={{ autoLabelEnabled: false }}
          filter={filter}
          viewportState={viewportState}
          onViewportState={setViewportState}
          tooltip={tooltipPoint}
          customTooltip={{
            class: AtlasTooltip,
            props: {
              showLink: true,
              simpleTooltip,
              onNavigate: (id: string) => openTab('analysis', 'bed/' + id),
            },
          }}
          selection={visualSelection}
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
