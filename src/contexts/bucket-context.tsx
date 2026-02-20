import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from 'react';

export type SelectionBucket = {
  id: string;
  name: string;
  bedIds: string[];
  enabled: boolean;
  createdAt: number;
  order: number;
};

type BucketContextValue = {
  buckets: SelectionBucket[];
  createBucket: (name: string, bedIds: string[]) => string;
  deleteBucket: (id: string) => void;
  toggleBucket: (id: string) => void;
  renameBucket: (id: string, name: string) => void;
  reorderBuckets: (orderedIds: string[]) => void;
  clearBuckets: () => void;
  enabledBedIds: string[];
  bucketCount: number;
};

const STORAGE_KEY = 'bedbase-buckets';

function loadBuckets(): SelectionBucket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a: SelectionBucket, b: SelectionBucket) => a.order - b.order);
  } catch {
    return [];
  }
}

function saveBuckets(buckets: SelectionBucket[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buckets));
}

const BucketContext = createContext<BucketContextValue | null>(null);

export function BucketProvider({ children }: { children: ReactNode }) {
  const [buckets, setBuckets] = useState<SelectionBucket[]>(loadBuckets);

  useEffect(() => {
    saveBuckets(buckets);
  }, [buckets]);

  const sorted = useMemo(
    () => [...buckets].sort((a, b) => a.order - b.order),
    [buckets],
  );

  const createBucket = (name: string, bedIds: string[]) => {
    const id = crypto.randomUUID();
    const maxOrder = buckets.length > 0 ? Math.max(...buckets.map((b) => b.order)) : -1;
    const bucket: SelectionBucket = {
      id,
      name,
      bedIds,
      enabled: true,
      createdAt: Date.now(),
      order: maxOrder + 1,
    };
    setBuckets((prev) => [...prev, bucket]);
    return id;
  };

  const deleteBucket = (id: string) => {
    setBuckets((prev) => prev.filter((b) => b.id !== id));
  };

  const toggleBucket = (id: string) => {
    setBuckets((prev) =>
      prev.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b)),
    );
  };

  const renameBucket = (id: string, name: string) => {
    setBuckets((prev) =>
      prev.map((b) => (b.id === id ? { ...b, name } : b)),
    );
  };

  const reorderBuckets = (orderedIds: string[]) => {
    setBuckets((prev) =>
      prev.map((b) => {
        const idx = orderedIds.indexOf(b.id);
        return idx >= 0 ? { ...b, order: idx } : b;
      }),
    );
  };

  const clearBuckets = () => setBuckets([]);

  const enabledBedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const b of buckets) {
      if (b.enabled) {
        for (const id of b.bedIds) ids.add(id);
      }
    }
    return Array.from(ids);
  }, [buckets]);

  const value: BucketContextValue = {
    buckets: sorted,
    createBucket,
    deleteBucket,
    toggleBucket,
    renameBucket,
    reorderBuckets,
    clearBuckets,
    enabledBedIds,
    bucketCount: sorted.length,
  };

  return <BucketContext.Provider value={value}>{children}</BucketContext.Provider>;
}

export function useBucket() {
  const ctx = useContext(BucketContext);
  if (!ctx) throw new Error('useBucket must be used within BucketProvider');
  return ctx;
}
