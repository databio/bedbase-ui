type Props = {
  columns: string[];
  rows?: number;
};

export function SkeletonTable({ columns, rows = 10 }: Props) {
  return (
    <div className="border border-base-300 rounded-lg overflow-hidden">
      <div className="h-9 bg-base-200 border-b border-base-300" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-base-300 last:border-b-0">
          {columns.map((cls, j) => (
            <div key={j} className={`bg-base-300 animate-pulse ${cls}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
