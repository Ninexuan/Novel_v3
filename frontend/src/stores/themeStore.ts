import { create } from 'zustand';

interface ThemeStore {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
}

// Initialize theme from localStorage
const getInitialTheme = () => {
  const stored = localStorage.getItem('theme-storage');
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      return state.isDark || false;
    } catch {
      return false;
    }
  }
  return false;
};

export const useThemeStore = create<ThemeStore>((set) => {
  const initialIsDark = getInitialTheme();
  updateDOMTheme(initialIsDark);

  return {
    isDark: initialIsDark,
    toggleTheme: () =>
      set((state) => {
        const newIsDark = !state.isDark;
        updateDOMTheme(newIsDark);
        localStorage.setItem('theme-storage', JSON.stringify({ state: { isDark: newIsDark } }));
        return { isDark: newIsDark };
      }),
    setTheme: (isDark) => {
      updateDOMTheme(isDark);
      localStorage.setItem('theme-storage', JSON.stringify({ state: { isDark } }));
      set({ isDark });
    },
  };
});

function updateDOMTheme(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

