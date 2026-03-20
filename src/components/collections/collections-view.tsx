import { CollectionsEmpty } from './collections-empty';
import { SelectionList } from './selection-list';
import { SelectionDetail } from './selection-detail';
import { CollectionDetail } from './collection-detail';
import { FileComparison } from './file-comparison';

export function CollectionsView({ param }: { param?: string }) {
  if (param?.startsWith('bedset/')) return <CollectionDetail bedsetId={param.slice(7)} />;
  if (param === 'selection') return <SelectionList />;
  if (param?.startsWith('selection/')) return <SelectionDetail selectionId={param.slice(10)} />;
  if (param === 'files') return <FileComparison />;
  return <CollectionsEmpty />;
}
