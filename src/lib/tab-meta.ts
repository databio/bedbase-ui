import { Search, FlaskConical, ScatterChart, FolderOpen, ShoppingCart, type LucideIcon } from 'lucide-react';
import type { TabId } from '../contexts/tab-context';

export type TabMeta = {
  label: string;
  icon: LucideIcon;
  description: string;
  color: string;
};

export const tabMeta: Record<TabId, TabMeta> = {
  search: {
    label: 'Search',
    icon: Search,
    description: 'Find BED files by text query or upload your own to find similar files in the database.',
    color: 'primary',
  },
  analysis: {
    label: 'Analysis',
    icon: FlaskConical,
    description: 'View statistics, chromosome distributions, and genomic annotations for any BED file.',
    color: 'success',
  },
  umap: {
    label: 'UMAP',
    icon: ScatterChart,
    description: 'Explore the BEDbase embedding space. See where files cluster and how they relate.',
    color: 'warning',
  },
  collections: {
    label: 'Collections',
    icon: FolderOpen,
    description: 'Browse curated BED file sets grouped by experiment, cell type, or project.',
    color: 'accent',
  },
  cart: {
    label: 'Cart',
    icon: ShoppingCart,
    description: 'Review and download your selected BED files.',
    color: 'info',
  },
};

export const tabIds = Object.keys(tabMeta) as TabId[];

export const tabColorClasses: Record<string, {
  text: string;
  bg: string;
  borderTop: string;
  borderLeft: string;
  bgSubtle: string;
  bgFaint: string;
}> = {
  primary: { text: 'text-primary', bg: 'bg-primary', borderTop: 'border-t-primary', borderLeft: 'border-l-primary', bgSubtle: 'bg-primary/15', bgFaint: 'bg-primary/8' },
  info:    { text: 'text-info',    bg: 'bg-info',    borderTop: 'border-t-info',    borderLeft: 'border-l-info',    bgSubtle: 'bg-info/15',    bgFaint: 'bg-info/8' },
  success: { text: 'text-success', bg: 'bg-success', borderTop: 'border-t-success', borderLeft: 'border-l-success', bgSubtle: 'bg-success/15', bgFaint: 'bg-success/8' },
  warning: { text: 'text-warning', bg: 'bg-warning', borderTop: 'border-t-warning', borderLeft: 'border-l-warning', bgSubtle: 'bg-warning/15', bgFaint: 'bg-warning/8' },
  accent:  { text: 'text-accent',  bg: 'bg-accent',  borderTop: 'border-t-accent',  borderLeft: 'border-l-accent',  bgSubtle: 'bg-accent/15',  bgFaint: 'bg-accent/8' },
};
