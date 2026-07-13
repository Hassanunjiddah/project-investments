import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
};

type ThemeMode = 'light' | 'dark';

type UiState = {
  toasts: ToastItem[];
  theme: ThemeMode;
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
  setTheme: (theme: ThemeMode) => void;
  tabBarVisible: boolean;
  hideTabBar: () => void;
  showTabBar: () => void;
};

let toastCounter = 0;

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  theme: 'light',
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
  setTheme: (theme) => set({ theme }),
  tabBarVisible: true,
  hideTabBar: () => set({ tabBarVisible: false }),
  showTabBar: () => set({ tabBarVisible: true }),
}));
