import { Fragment } from 'react';

type Crumb = {
  label: string;
  onClick?: () => void;
};

export function Breadcrumb({ crumbs, className }: { crumbs: Crumb[]; className?: string }) {
  return (
    <nav className={`flex items-center gap-1 text-xs text-base-content/40 ${className ?? 'mb-4'}`}>
      {crumbs.map((crumb, i) => (
        <Fragment key={i}>
          {i > 0 && <span>/</span>}
          {crumb.onClick ? (
            <button
              onClick={crumb.onClick}
              className="hover:text-base-content/60 transition-colors cursor-pointer"
            >
              {crumb.label}
            </button>
          ) : (
            <span className="text-base-content/60">{crumb.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
