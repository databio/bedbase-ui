import { useEffect, useRef, useState } from 'react';
import { AArrowDown, AArrowUp, ALargeSmall, Moon, MonitorCog, Sun, SunMoon } from 'lucide-react';
import { useSettings, type FontSize, type Theme } from '../../contexts/settings-context';

const themeOptions: { value: Theme; icon: React.ReactNode; title: string }[] = [
  { value: 'light', icon: <Sun size={14} />, title: 'Light' },
  { value: 'auto', icon: <SunMoon size={14} />, title: 'Auto' },
  { value: 'dark', icon: <Moon size={14} />, title: 'Dark' },
];

const fontSizeOptions: { value: FontSize; icon: React.ReactNode; title: string }[] = [
  { value: 'sm', icon: <AArrowDown size={14} />, title: 'Small' },
  { value: 'md', icon: <ALargeSmall size={14} />, title: 'Medium' },
  { value: 'lg', icon: <AArrowUp size={14} />, title: 'Large' },
];

export function SettingsPopover() {
  const { theme, fontSize, setTheme, setFontSize } = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center p-0 hover:text-base-content transition-colors cursor-pointer"
        aria-label="Settings"
        aria-expanded={open}
      >
        <MonitorCog size={18} />
      </button>

      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-base-100 border border-base-300 rounded-box shadow-lg p-3 z-50 animate-fade-in flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-1.5">
              Theme
            </p>
            <div className="flex gap-1">
              {themeOptions.map(({ value, icon, title }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  title={title}
                  className={`flex-1 min-w-0 flex items-center justify-center btn btn-xs ${
                    theme === value ? 'btn-primary' : 'btn-ghost'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-1.5">
              Font Size
            </p>
            <div className="flex gap-1">
              {fontSizeOptions.map(({ value, icon, title }) => (
                <button
                  key={value}
                  onClick={() => setFontSize(value)}
                  title={title}
                  className={`flex-1 min-w-0 flex items-center justify-center btn btn-xs ${
                    fontSize === value ? 'btn-primary' : 'btn-ghost'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
