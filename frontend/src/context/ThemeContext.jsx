import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

/**
 * Detects the initial theme from:
 * 1. localStorage preference
 * 2. System preference (prefers-color-scheme)
 * 3. Falls back to 'dark'
 */
function getInitialTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // localStorage not available
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

let transitionTimer;

function applyTheme(theme, animate = false) {
  const root = document.documentElement;
  if (animate) {
    // Briefly enable colour transitions so the switch feels smooth, not jarring
    root.classList.add('theme-transition');
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => root.classList.remove('theme-transition'), 300);
  }
  root.setAttribute('data-theme', theme);
  // Update meta theme-color for mobile browsers
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#F6F8FB' : '#0A0D14');
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  // Apply theme on mount (in case inline script didn't run)
  useEffect(() => {
    applyTheme(theme);
  }, []);

  // Listen for system theme changes when no user preference is stored
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      const savedPref = localStorage.getItem('theme');
      if (!savedPref) {
        const newTheme = e.matches ? 'dark' : 'light';
        setTheme(newTheme);
        applyTheme(newTheme, true);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setThemeMode = useCallback((mode) => {
    if (mode === 'dark' || mode === 'light') {
      setTheme(mode);
      localStorage.setItem('theme', mode);
      applyTheme(mode, true);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    applyTheme(next, true);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
