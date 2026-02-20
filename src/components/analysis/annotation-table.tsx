import type { BedAnalysis } from '../../lib/bed-analysis';

const FIELDS: { label: string; key: keyof NonNullable<BedAnalysis['metadata']> }[] = [
  { label: 'Organism', key: 'species' },
  { label: 'Cell type', key: 'cellType' },
  { label: 'Cell line', key: 'cellLine' },
  { label: 'Tissue', key: 'tissue' },
  { label: 'Assay', key: 'assay' },
  { label: 'Antibody', key: 'antibody' },
  { label: 'Target', key: 'target' },
  { label: 'Treatment', key: 'treatment' },
  { label: 'Library source', key: 'librarySource' },
];

export function AnnotationTable({ metadata }: { metadata: NonNullable<BedAnalysis['metadata']> }) {
  const rows = FIELDS.filter(({ key }) => metadata[key]);
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">
        Annotation
      </h3>
      <div className="overflow-x-auto border border-base-300 rounded-lg bg-base-100">
        <table className="table table-sm text-xs w-full">
          <tbody>
            {rows.map(({ label, key }) => (
              <tr key={key}>
                <td className="font-medium text-base-content/60 w-36">{label}</td>
                <td>{metadata[key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
