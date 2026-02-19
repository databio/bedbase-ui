import { useTab } from '../../contexts/tab-context';
import type { BedAnalysis } from '../../lib/bed-analysis';

type Bedset = NonNullable<BedAnalysis['bedsets']>[number];

export function BedsetMemberships({ bedsets }: { bedsets: Bedset[] }) {
  const { openTab } = useTab();

  if (bedsets.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide">
        BEDset memberships
      </h3>
      <div className="overflow-x-auto border border-base-300 rounded-lg bg-white">
        <table className="table table-sm text-xs w-full">
          <thead className="text-base-content">
            <tr>
              <th>Name</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {bedsets.map((bs) => (
              <tr
                key={bs.id}
                onClick={() => openTab('collections', bs.id)}
                className="hover:bg-primary/5 cursor-pointer transition-colors"
              >
                <td className="font-medium text-primary">{bs.name}</td>
                <td className="text-base-content/50">{bs.description || '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
