import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'auto';
export type FontSize = 'sm' | 'md' | 'lg';

interface SettingsContextType {
  theme: Theme;
  fontSize: FontSize;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: FontSize) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const THEME_KEY = 'bedbase-theme';
const FONT_SIZE_KEY = 'bedbase-font-size';

const fontSizePx: Record<FontSize, string> = {
  sm: '16px',
  md: '18px',
  lg: '20px',
};

function resolveThemeName(theme: Theme): 'bedbase' | 'bedbase-dark' {
  if (theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'bedbase-dark' : 'bedbase';
  }
  return theme === 'dark' ? 'bedbase-dark' : 'bedbase';
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', resolveThemeName(theme));
}

function applyFontSize(size: FontSize, preserveScroll: boolean) {
  if (preserveScroll) {
    const distanceFromBottom =
      document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
    document.documentElement.style.fontSize = fontSizePx[size];
    const newScrollTop = document.documentElement.scrollHeight - window.innerHeight - distanceFromBottom;
    window.scrollTo({ top: newScrollTop, behavior: 'instant' });
  } else {
    document.documentElement.style.fontSize = fontSizePx[size];
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme | null) ?? 'auto',
  );
  const [fontSize, setFontSizeState] = useState<FontSize>(
    () => (localStorage.getItem(FONT_SIZE_KEY) as FontSize | null) ?? 'md',
  );
  const fontSizeMounted = useRef(false);

  useEffect(() => {
    applyTheme(theme);
    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('auto');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  useEffect(() => {
    const isInitialMount = !fontSizeMounted.current;
    fontSizeMounted.current = true;
    applyFontSize(fontSize, !isInitialMount);
  }, [fontSize]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
  };

  const setFontSize = (s: FontSize) => {
    setFontSizeState(s);
    localStorage.setItem(FONT_SIZE_KEY, s);
  };

  return (
    <SettingsContext.Provider value={{ theme, fontSize, setTheme, setFontSize }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
