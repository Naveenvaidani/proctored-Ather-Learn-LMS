import { create } from "zustand";

type BehaviorSignal = "steady" | "warning" | "critical";

interface UiStore {
  focusMode: boolean;
  behaviorSignal: BehaviorSignal;
  setFocusMode: (next: boolean) => void;
  setBehaviorSignal: (next: BehaviorSignal) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  focusMode: false,
  behaviorSignal: "steady",
  setFocusMode: (next) => set({ focusMode: next }),
  setBehaviorSignal: (next) => set({ behaviorSignal: next })
}));
