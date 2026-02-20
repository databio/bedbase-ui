import { CollectionsEmpty } from './collections-empty';
import { BedsetList } from './bedset-list';
import { SelectionList } from './selection-list';
import { SelectionDetail } from './selection-detail';
import { CollectionDetail } from './collection-detail';

export function CollectionsView({ param }: { param?: string }) {
  if (param === 'bedset') return <BedsetList />;
  if (param?.startsWith('bedset/')) return <CollectionDetail bedsetId={param.slice(7)} />;
  if (param === 'selection') return <SelectionList />;
  if (param?.startsWith('selection/')) return <SelectionDetail selectionId={param.slice(10)} />;
  return <CollectionsEmpty />;
}
