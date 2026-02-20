import { Github } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useServiceInfo } from '../../queries/use-service-info';
import { API_BASE } from '../../lib/file-model-utils';
import { SettingsPopover } from './settings-popover';

function StatusDot({ className }: { className: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${className}`} />;
}

export function Footer() {
  const { data, isLoading, isFetching, isError } = useServiceInfo();
  const versions = data?.component_versions;

  return (
    <footer className="border-t border-base-300 bg-base-100 px-4 md:px-6 py-6">
      <div className="relative flex items-center">
        {/* Left: API status + settings */}
        <div className="flex items-center gap-3 text-sm text-base-content/50">
          <div className="flex items-center gap-1.5">
          {isLoading || isFetching ? (
            <>
              <StatusDot className="bg-warning" />
              <span>Connecting...</span>
            </>
          ) : isError ? (
            <>
              <StatusDot className="bg-error" />
              <span>No connection</span>
            </>
          ) : (
            <>
              <StatusDot className="bg-success" />
              <span>Connected to API</span>
            </>
          )}
          </div>
          <span className="text-base-content/20">·</span>
          <SettingsPopover />
        </div>

        {/* Center: version badges (absolutely centered) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
            {versions ? (
              <>
                <span className="badge badge-ghost badge-sm border-primary/30 text-primary/80 font-medium">bedhost {versions.bedhost_version}</span>
                <span className="badge badge-ghost badge-sm border-primary/30 text-primary/80 font-medium">bbconf {versions.bbconf_version}</span>
                <span className="badge badge-ghost badge-sm border-primary/30 text-primary/80 font-medium">geniml {versions.geniml_version}</span>
              </>
            ) : (
              <>
                <span className="badge badge-ghost badge-sm border-primary/30 text-primary/80 font-medium">bedhost</span>
                <span className="badge badge-ghost badge-sm border-primary/30 text-primary/80 font-medium">bbconf</span>
                <span className="badge badge-ghost badge-sm border-primary/30 text-primary/80 font-medium">geniml</span>
              </>
            )}
          </div>
        </div>

        {/* Right: links */}
        <div className="flex items-center gap-5 text-sm text-base-content/50 ml-auto">
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
            href={API_BASE}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-base-content transition-colors"
          >
            API
          </a>
          <a
            href="https://github.com/databio/bedbase-ui"
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
