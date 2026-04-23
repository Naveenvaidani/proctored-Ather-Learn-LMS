import { create } from "zustand";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

interface SessionState {
  token: string | null;
  user: SessionUser | null;
  setSession: (token: string, user: SessionUser) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  token: null,
  user: null,
  setSession: (token, user) => set({ token, user }),
  clearSession: () => set({ token: null, user: null })
}));
