import { EmbeddingViewMosaic } from 'embedding-atlas/react';
import { useEffect, useState, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import * as vg from '@uwdata/vgplot';

import { tableau20 } from '../../lib/tableau20';
import { isPointInPolygon, type UmapPoint } from '../../lib/umap-utils';
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
  filterSelection?: any;
  onFilterSelectionChange?: (selection: any) => void;
  selectedPoints?: UmapPoint[];
  onSelectedPointsChange?: (points: UmapPoint[]) => void;
  onPersistentPointsChange?: (points: UmapPoint[]) => void;
  onPreselectedMatchChange?: (matched: number, total: number) => void;
  highlightPoints?: UmapPoint[];
  className?: string;
};

export type EmbeddingPlotRef = {
  centerOnBedId: (bedId: string, scale?: number, reselect?: boolean) => Promise<void>;
  handleFileUpload: () => Promise<void>;
  handleFileRemove: () => Promise<void>;
  handleLegendClick: (item: any) => void;
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
    filterSelection,
    onFilterSelectionChange,
    selectedPoints,
    onSelectedPointsChange,
    onPersistentPointsChange,
    onPreselectedMatchChange,
    highlightPoints,
    className,
  } = props;

  const { coordinator, initializeData, addCustomPoint, deleteCustomPoint, webglStatus } =
    useMosaicCoordinator();
  const { openTab } = useTab();

  const containerRef = useRef<HTMLDivElement>(null);

  // Persistent points in state so they participate in visualSelection recomputation
  const [persistentPoints, setPersistentPoints] = useState<UmapPoint[]>([]);
  const persistentRef = useRef<{ preselected: UmapPoint[]; bucket: UmapPoint[] }>({ preselected: [], bucket: [] });

  const updatePersistent = (key: 'preselected' | 'bucket', points: UmapPoint[]) => {
    persistentRef.current[key] = points;
    const seen = new Set<string>();
    const merged: UmapPoint[] = [];
    for (const p of persistentRef.current.preselected) {
      if (!seen.has(p.identifier)) { seen.add(p.identifier); merged.push(p); }
    }
    for (const p of persistentRef.current.bucket) {
      if (!seen.has(p.identifier)) { seen.add(p.identifier); merged.push(p); }
    }
    setPersistentPoints(merged);
    onPersistentPointsChange?.(merged);
  };

  const [containerWidth, setContainerWidth] = useState(900);
  const [containerHeight, setContainerHeight] = useState(500);
  const [isReady, setIsReady] = useState(false);
  const [tooltipPoint, setTooltipPoint] = useState<any>(null);
  const [viewportState, setViewportState] = useState<any>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [pendingSelection, setPendingSelection] = useState<UmapPoint[] | null>(null);
  const [rangeSelectionValue, setRangeSelectionValue] = useState<any>(undefined);

  const filter = useMemo(() => vg.Selection.intersect(), []);
  const legendFilterSource = useMemo(() => ({}), []);

  // visualSelection: always includes persistent points so they never disappear
  const visualSelection = useMemo(() => {
    const seen = new Set<string>();
    const merged: UmapPoint[] = [];
    // Persistent points first (always rendered)
    for (const p of persistentPoints) {
      if (!seen.has(p.identifier)) { seen.add(p.identifier); merged.push(p); }
    }
    // Then interactive selection
    for (const p of (selectedPoints || [])) {
      if (!seen.has(p.identifier)) { seen.add(p.identifier); merged.push(p); }
    }
    // Then highlight points
    for (const p of (highlightPoints || [])) {
      if (!seen.has(p.identifier)) { seen.add(p.identifier); merged.push(p); }
    }
    return merged;
  }, [selectedPoints, highlightPoints, persistentPoints]);

  const centerOnPoint = (point: any, scale = 1, tooltip = true) => {
    if (tooltip) {
      setTooltipPoint(null);
      setTimeout(() => setTooltipPoint(point), 300);
    }
    setViewportState({ x: point.x, y: point.y, scale });
  };

  const queryPoints = async (ids: string[]): Promise<UmapPoint[]> => {
    if (ids.length === 0) return [];
    const result: any = await coordinator.query(
      `SELECT x, y, cell_line_category, assay_category, ${colorGrouping} as category,
        name as text, id as identifier,
        {'Description': description, 'Assay': assay, 'Cell Line': cell_line} as fields
       FROM data WHERE id IN ('${ids.join("','")}')`,
      { type: 'json' },
    );
    return result || [];
  };

  const centerOnBedId = async (bedId: string, scale = 1, reselect = false) => {
    if (!isReady) return;
    const points = await queryPoints([bedId]);
    if (points.length > 0) {
      centerOnPoint(points[0], scale, true);
      if (reselect) onSelectedPointsChange?.([points[0]]);
    }
  };

  const handleFileUpload = async () => {
    try {
      if (customCoordinates && customCoordinates.length >= 2) {
        await addCustomPoint(customCoordinates[0], customCoordinates[1], customFilename);
        coordinator.clear();
        const updatedLegend = await fetchLegendItems(coordinator);
        onLegendItemsChange?.(updatedLegend);
        // After remount, center on custom point and add to selection (non-sticky)
        setDataVersion((v) => v + 1);
        setTimeout(async () => {
          const points = await queryPoints(['custom_point']);
          if (points.length > 0) {
            centerOnPoint(points[0], 0.3, true);
            // Merge with preselected points
            const merged = [...persistentPoints];
            const seen = new Set(merged.map((p) => p.identifier));
            if (!seen.has(points[0].identifier)) merged.push(points[0]);
            onSelectedPointsChange?.(merged);
          }
        }, 200);
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
      const newSelection = selectedPoints?.filter((p) => p.identifier !== 'custom_point');
      setPendingSelection(newSelection || []);
      setDataVersion((v) => v + 1);
    } catch (error) {
      console.error('Error removing file:', error);
    }
  };

  const OTHER_CATEGORY = 18;
  const UPLOADED_CATEGORY = 19;

  const fetchLegendItems = async (coord: any) => {
    const colName = colorGrouping.replace('_category', '');
    const query = `SELECT
      CASE
        WHEN ${colorGrouping} = ${UPLOADED_CATEGORY} THEN 'Uploaded BED'
        WHEN ${colorGrouping} = ${OTHER_CATEGORY} THEN 'Other'
        ELSE MIN(${colName})
      END as name,
      ${colorGrouping} as category
      FROM data
      GROUP BY ${colorGrouping}
      ORDER BY ${colorGrouping}`;
    return (await coord.query(query, { type: 'json' })) as any[];
  };

  const queryByCategory = async (category: string): Promise<UmapPoint[]> => {
    const result: any = await coordinator.query(
      `SELECT x, y, cell_line_category, assay_category,
        name as text, id as identifier,
        {'Description': description, 'Assay': assay, 'Cell Line': cell_line} as fields
       FROM data WHERE ${colorGrouping} = '${category}'`,
      { type: 'json' },
    );
    return result || [];
  };

  const handleLegendClick = (item: any) => {
    setRangeSelectionValue(null);
    // Clear interactive selection — persistent points stay via visualSelection
    onSelectedPointsChange?.([]);
    if (filterSelection?.category === item.category) {
      onFilterSelectionChange?.(null);
      filter.update({ source: legendFilterSource, value: null, predicate: null });
    } else {
      onFilterSelectionChange?.(item);
      filter.update({
        source: legendFilterSource,
        value: item.category,
        predicate: vg.eq(colorGrouping, item.category),
      });
    }
  };

  const handlePointSelection = (dataPoints: any[] | null) => {
    if (!dataPoints || dataPoints.length === 0) {
      // Empty click — clear interactive selection (persistent points stay via visualSelection)
      onSelectedPointsChange?.([]);
      return;
    }
    // Set interactive selection — persistent points are merged in visualSelection
    onSelectedPointsChange?.(dataPoints.filter((p) => p != null));
  };

  const handleRangeSelection = async (coord: any, value: any) => {
    if (!value) return;

    let result: any[] | undefined;
    const filterClause = filterSelection
      ? ` AND ${colorGrouping} = '${filterSelection.category}'`
      : '';

    if (typeof value === 'object' && 'xMin' in value) {
      result = (await coord.query(
        `SELECT x, y, cell_line_category, assay_category, ${colorGrouping} as category,
          name as text, id as identifier,
          {'Description': description, 'Assay': assay, 'Cell Line': cell_line} as fields
         FROM data
         WHERE x >= ${value.xMin} AND x <= ${value.xMax} AND y >= ${value.yMin} AND y <= ${value.yMax}${filterClause}`,
        { type: 'json' },
      )) as any[];
    } else if (Array.isArray(value) && value.length > 0) {
      const xCoords = value.map((p: any) => p.x);
      const yCoords = value.map((p: any) => p.y);
      const xMin = Math.min(...xCoords);
      const xMax = Math.max(...xCoords);
      const yMin = Math.min(...yCoords);
      const yMax = Math.max(...yCoords);

      const candidates: any = await coord.query(
        `SELECT x, y, id as identifier FROM data
         WHERE x >= ${xMin} AND x <= ${xMax} AND y >= ${yMin} AND y <= ${yMax}${filterClause}`,
        { type: 'json' },
      );
      const filteredIds = candidates
        .filter((point: any) => isPointInPolygon(point, value))
        .map((p: any) => `'${p.identifier}'`)
        .join(',');

      if (filteredIds) {
        result = (await coord.query(
          `SELECT x, y, cell_line_category, assay_category, ${colorGrouping} as category,
            name as text, id as identifier,
            {'Description': description, 'Assay': assay, 'Cell Line': cell_line} as fields
           FROM data WHERE id IN (${filteredIds})${filterClause}`,
          { type: 'json' },
        )) as any[];
      } else {
        result = [];
      }
    }

    // Set interactive selection — persistent points are merged in visualSelection
    onSelectedPointsChange?.(result || []);
  };

  // Apply pending selection after dataVersion change
  useEffect(() => {
    if (pendingSelection !== null) {
      setTimeout(() => {
        onSelectedPointsChange?.(pendingSelection);
        setPendingSelection(null);
      }, 100);
    }
  }, [dataVersion, pendingSelection]);

  useEffect(() => {
    if (isReady && customCoordinates && !pendingSelection) {
      handleFileUpload();
    }
  }, [customCoordinates, isReady]);

  useEffect(() => {
    onFilterSelectionChange?.(null);
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
      updatePersistent('preselected', []);
      onPreselectedMatchChange?.(0, 0);
      return;
    }
    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 50));
      if (cancelled) return;
      const points = await queryPoints(preselectedIds);
      if (cancelled) return;
      onPreselectedMatchChange?.(points?.length ?? 0, preselectedIds.length);
      if (!points || points.length === 0) {
        updatePersistent('preselected', []);
        return;
      }
      updatePersistent('preselected', points);
      if (points.length === 1) {
        centerOnPoint(points[0], 0.1, true);
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
      updatePersistent('bucket', []);
      return;
    }

    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 100));
      if (cancelled) return;
      const bucketPoints = await queryPoints(bucketOnlyIds);
      if (cancelled) return;
      updatePersistent('bucket', bucketPoints || []);
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
      handleLegendClick,
      queryByCategory,
      clearRangeSelection: () => setRangeSelectionValue(null),
    }),
    [filterSelection, colorGrouping, selectedPoints],
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
