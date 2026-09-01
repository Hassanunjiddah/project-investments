import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  /** Optional reference code shown as a monospaced chip on the toast, e.g. PRSM-ABC-DECL002. */
  reference?: string;
};

type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'prism.theme';
const LEGACY_THEME_STORAGE_KEY = 'ribhshare.theme';

// Read the persisted theme synchronously on web (localStorage is sync).
// On native, AsyncStorage is async so we start with the default and let a
// hook hydrate later — not wired yet since the app is primarily web today.
function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return 'light';
  }
  const stored =
    window.localStorage.getItem(THEME_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') {
    // Migrate legacy key once.
    if (!window.localStorage.getItem(THEME_STORAGE_KEY)) {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, stored);
        window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    return stored;
  }
  // Optional: match the OS preference the first time.
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function persistTheme(theme: ThemeMode) {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore quota errors
  }
}

const AMOUNTS_HIDDEN_KEY = 'ribhshare.amountsHidden';

function readAmountsHidden(): boolean {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(AMOUNTS_HIDDEN_KEY) === '1';
}

function persistAmountsHidden(hidden: boolean) {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    window.localStorage.setItem(AMOUNTS_HIDDEN_KEY, hidden ? '1' : '0');
  } catch {
    // ignore quota errors
  }
}

type UiState = {
  toasts: ToastItem[];
  theme: ThemeMode;
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  /** When true, monetary figures on dashboards are masked. */
  amountsHidden: boolean;
  toggleAmountsHidden: () => void;
  tabBarVisible: boolean;
  hideTabBar: () => void;
  showTabBar: () => void;
  /** Brief pulse on the notifications bell when unread rises. */
  bellPulse: boolean;
  setBellPulse: (pulse: boolean) => void;
};

let toastCounter = 0;

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  theme: readInitialTheme(),
  pushToast: (toast) => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  setTheme: (theme) => {
    persistTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
    persistTheme(next);
    set({ theme: next });
  },
  amountsHidden: readAmountsHidden(),
  toggleAmountsHidden: () => {
    const next = !get().amountsHidden;
    persistAmountsHidden(next);
    set({ amountsHidden: next });
  },
  tabBarVisible: true,
  hideTabBar: () => set({ tabBarVisible: false }),
  showTabBar: () => set({ tabBarVisible: true }),
  bellPulse: false,
  setBellPulse: (pulse) => set({ bellPulse: pulse }),
}));
