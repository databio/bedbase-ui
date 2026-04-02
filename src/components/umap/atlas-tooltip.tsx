import { createRoot, type Root } from 'react-dom/client';

/** Shared ref set by EmbeddingPlot to control whether hover tooltips are shown */
export const tooltipGate = { enabled: false };

interface TooltipProps {
  tooltip?: {
    text: string;
    identifier: string;
    fields?: Record<string, string | number | null>;
    category?: number;
    x?: number;
    y?: number;
  };
  showLink?: boolean;
  simpleTooltip?: boolean;
  onNavigate?: (id: string) => void;
}

function TooltipContent({
  tooltip,
  showLink,
  simpleTooltip,
  onNavigate,
}: {
  tooltip: TooltipProps['tooltip'];
  showLink?: boolean;
  simpleTooltip?: boolean;
  onNavigate?: (id: string) => void;
}) {
  if (!tooltip || !tooltipGate.enabled) return null;
  return (
    <div
      className="border border-base-300 rounded-lg text-xs overflow-hidden"
      style={{
        maxWidth: '300px',
        backdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(255,255,255,0.5)',
      }}
    >
      {simpleTooltip ? (
        <div className="p-2">
          <div className="font-bold text-center">You are here!</div>
        </div>
      ) : (
        <div className="p-2">
          <div className="font-bold mb-1 line-clamp-2">{tooltip.text || 'Unnamed BED'}</div>
          {tooltip.fields && (
            <>
              {tooltip.fields.Description && (
                <p className="text-base-content/50 italic mb-2">
                  {tooltip.fields.Description}
                </p>
              )}
              <div className="flex flex-wrap gap-1">
                {tooltip.identifier !== 'custom_point' &&
                  Object.entries(tooltip.fields)
                    .filter(([key, val]) => key !== 'Description' && val != null && val !== '' && val !== 'UNKNOWN')
                    .map(([key, val]) => (
                      <span key={key} className="badge badge-sm border text-[10px]">
                        <span className="text-base-content/40">{key}:</span>{' '}
                        {typeof val === 'number' ? val.toLocaleString() : val}
                      </span>
                    ))
                }
              </div>
            </>
          )}
          {showLink && tooltip.identifier !== 'custom_point' && (
            <button
              className="btn btn-xs btn-primary mt-2"
              style={{ pointerEvents: 'auto' }}
              onClick={() => onNavigate?.(tooltip.identifier)}
            >
              Go!
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export class AtlasTooltip {
  private root: Root;
  private target: HTMLElement;
  private showLink: boolean;
  private simpleTooltip: boolean;
  private onNavigate?: (id: string) => void;

  constructor(target: HTMLElement, props: TooltipProps) {
    this.root = createRoot(target);
    this.target = target;
    this.showLink = props.showLink || false;
    this.simpleTooltip = props.simpleTooltip || false;
    this.onNavigate = props.onNavigate;
    this.update(props);
  }

  update(props: TooltipProps) {
    // Hide the library's container when tooltips are suppressed
    if (!tooltipGate.enabled) {
      this.target.style.display = 'none';
    } else {
      this.target.style.display = '';
    }
    this.root.render(
      <TooltipContent
        tooltip={props.tooltip}
        showLink={this.showLink}
        simpleTooltip={this.simpleTooltip}
        onNavigate={this.onNavigate}
      />,
    );
  }

  destroy() {
    // Defer unmount to avoid "synchronously unmount during render" error
    setTimeout(() => this.root.unmount(), 0);
  }
}
