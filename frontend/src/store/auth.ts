import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface JwtUser {
  sub: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

interface AuthState {
  token: string | null;
  user: JwtUser | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}

function parseJwt(token: string): JwtUser | null {
  try {
    const base64Payload = token.split('.')[1];
    const payload = JSON.parse(atob(base64Payload));
    return payload as JwtUser;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => set({
        token,
        user: token ? parseJwt(token) : null,
      }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'nexora-auth-storage',
    }
  )
);
