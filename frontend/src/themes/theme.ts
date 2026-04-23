import { create } from "zustand";

type ThemeMode = "light" | "dark" | "system";

interface ThemeStore {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  syncFromSystem: () => void;
}

function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") {
    return mode;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyRootTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: "system",
  resolved: "light",
  setMode: (mode) => {
    const resolved = resolveMode(mode);
    localStorage.setItem("aether.theme", mode);
    applyRootTheme(resolved);
    set({ mode, resolved });
  },
  syncFromSystem: () => {
    const currentMode = get().mode;
    const resolved = resolveMode(currentMode);
    applyRootTheme(resolved);
    set({ resolved });
  }
}));

export function applyThemePreference() {
  const storedMode = (localStorage.getItem("aether.theme") as ThemeMode | null) ?? "system";
  useThemeStore.getState().setMode(storedMode);

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = () => {
    useThemeStore.getState().syncFromSystem();
  };

  media.addEventListener("change", listener);
}
