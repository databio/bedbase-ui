export type KvRow = { label: string; value: string; href?: string };

export function KvTable({ title, rows }: { title: string; rows: KvRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide">
        {title}
      </h3>
      <div className="overflow-x-auto border border-base-300 rounded-lg bg-base-100">
        <table className="table table-sm text-xs w-full">
          <tbody>
            {rows.map(({ label, value, href }, i) => (
              <tr key={label} className={i % 2 === 1 ? 'bg-base-200' : ''}>
                <td className="font-medium text-base-content/60 w-44">{label}</td>
                <td className="text-base-content/50">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {value}
                    </a>
                  ) : value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
