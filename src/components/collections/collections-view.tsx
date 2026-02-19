import { CollectionsList } from './collections-list';
import { CollectionDetail } from './collection-detail';

export function CollectionsView({ param }: { param?: string }) {
  if (param) return <CollectionDetail bedsetId={param} />;
  return <CollectionsList />;
}
