import { create } from 'zustand';
import type { UserDto } from '@smp/shared';

const KEY = 'smp.token';

const readToken = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

interface AuthState {
  token: string | null;
  user: UserDto | null;
  setSession: (token: string, user: UserDto) => void;
  setUser: (user: UserDto) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: readToken(),
  user: null,
  setSession: (token, user) => {
    try {
      sessionStorage.setItem(KEY, token);
    } catch {
      /* storage unavailable */
    }
    set({ token, user });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
    set({ token: null, user: null });
  },
}));
