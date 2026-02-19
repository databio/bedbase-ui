import { Github } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-base-300 bg-base-100 px-4 md:px-6 py-6">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Version badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="badge badge-ghost badge-sm border-primary/30 text-primary/70">bedhost</span>
          <span className="badge badge-ghost badge-sm border-primary/30 text-primary/70">bbconf</span>
          <span className="badge badge-ghost badge-sm border-primary/30 text-primary/70">geniml</span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-5 text-sm text-base-content/50">
          <Link
            to="/metrics"
            className="hover:text-base-content transition-colors"
          >
            Metrics
          </Link>
          <a
            href="https://docs.bedbase.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-base-content transition-colors"
          >
            Docs
          </a>
          <a
            href="https://api.bedbase.org/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-base-content transition-colors"
          >
            API
          </a>
          <a
            href="https://github.com/databio"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-base-content transition-colors"
          >
            <Github size={18} />
          </a>
        </div>
      </div>
    </footer>
  );
}
