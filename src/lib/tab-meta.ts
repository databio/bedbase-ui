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
    color: 'accent',
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
    color: 'info',
  },
  cart: {
    label: 'Cart',
    icon: ShoppingCart,
    description: 'Review and download your selected BED files.',
    color: 'success',
  },
};

export const tabIds = Object.keys(tabMeta) as TabId[];

export const tabColorClasses: Record<string, {
  text: string;
  bg: string;
  borderTop: string;
  borderTopFaint: string;
  borderLeft: string;
  bgSubtle: string;
  bgFaint: string;
  glowFrom: string;
}> = {
  primary: { text: 'text-primary', bg: 'bg-primary', borderTop: 'border-t-primary', borderTopFaint: 'border-t-primary/60', borderLeft: 'border-l-primary', bgSubtle: 'bg-primary/15', bgFaint: 'bg-primary/8', glowFrom: 'from-primary/10' },
  info:    { text: 'text-info',    bg: 'bg-info',    borderTop: 'border-t-info',    borderTopFaint: 'border-t-info/60',    borderLeft: 'border-l-info',    bgSubtle: 'bg-info/15',    bgFaint: 'bg-info/8',    glowFrom: 'from-info/20' },
  success: { text: 'text-success', bg: 'bg-success', borderTop: 'border-t-success', borderTopFaint: 'border-t-success/60', borderLeft: 'border-l-success', bgSubtle: 'bg-success/15', bgFaint: 'bg-success/8', glowFrom: 'from-success/10' },
  warning: { text: 'text-warning', bg: 'bg-warning', borderTop: 'border-t-warning', borderTopFaint: 'border-t-warning/60', borderLeft: 'border-l-warning', bgSubtle: 'bg-warning/15', bgFaint: 'bg-warning/8', glowFrom: 'from-warning/10' },
  accent:  { text: 'text-accent',  bg: 'bg-accent',  borderTop: 'border-t-accent',  borderTopFaint: 'border-t-accent/60',  borderLeft: 'border-l-accent',  bgSubtle: 'bg-accent/15',  bgFaint: 'bg-accent/8',  glowFrom: 'from-accent/10' },
  error:   { text: 'text-error',   bg: 'bg-error',   borderTop: 'border-t-error',   borderTopFaint: 'border-t-error/60',   borderLeft: 'border-l-error',   bgSubtle: 'bg-error/15',   bgFaint: 'bg-error/8',   glowFrom: 'from-error/10' },
};
