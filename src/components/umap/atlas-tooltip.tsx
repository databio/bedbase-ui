import { createRoot, type Root } from 'react-dom/client';

interface TooltipProps {
  tooltip?: {
    text: string;
    identifier: string;
    fields?: {
      Assay: string;
      'Cell Line': string;
      Description: string;
    };
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
  if (!tooltip) return null;
  return (
    <div
      className="border border-base-300 rounded-lg text-xs overflow-hidden"
      style={{
        maxWidth: '300px',
        pointerEvents: 'none',
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
          <div className="font-bold mb-1">{tooltip.text || 'Unnamed BED'}</div>
          {tooltip.fields && (
            <>
              <p className="text-base-content/50 italic mb-2">
                {tooltip.fields.Description || 'No description available'}
              </p>
              <div className="flex flex-wrap gap-1">
                {tooltip.identifier !== 'custom_point' && (
                  <>
                    <span className="badge badge-sm border text-[10px]">
                      <span className="text-base-content/40">cell_line:</span>{' '}
                      {tooltip.fields['Cell Line'] || 'N/A'}
                    </span>
                    <span className="badge badge-sm border text-[10px]">
                      <span className="text-base-content/40">assay:</span>{' '}
                      {tooltip.fields.Assay || 'N/A'}
                    </span>
                    <span className="badge badge-sm border text-[10px]">
                      <span className="text-base-content/40">id:</span>{' '}
                      {tooltip.identifier || 'N/A'}
                    </span>
                  </>
                )}
                <span className="badge badge-sm border text-[10px]">
                  <span className="text-base-content/40">x:</span>{' '}
                  {tooltip.x ? tooltip.x.toFixed(6) : 'N/A'}
                </span>
                <span className="badge badge-sm border text-[10px]">
                  <span className="text-base-content/40">y:</span>{' '}
                  {tooltip.y ? tooltip.y.toFixed(6) : 'N/A'}
                </span>
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
  private showLink: boolean;
  private simpleTooltip: boolean;
  private onNavigate?: (id: string) => void;

  constructor(target: HTMLElement, props: TooltipProps) {
    this.root = createRoot(target);
    this.showLink = props.showLink || false;
    this.simpleTooltip = props.simpleTooltip || false;
    this.onNavigate = props.onNavigate;
    this.update(props);
  }

  update(props: TooltipProps) {
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
