import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type UserRole = 'student' | 'teacher' | 'admin' | null;

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  verifiedTeacher?: boolean;
  avatarUrl?: string;
  gender?: string;
  region?: string;
  phone?: string;
}

export interface AuthSession {
  token: string;
  user: UserProfile;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (session: AuthSession) => void;
  logout: () => void;
  updateUser: (partial: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {},
  logout: () => {},
  updateUser: () => {},
});

const AUTH_STORAGE_KEY = 'auth-storage';

export async function getStoredAuthToken() {
  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed?.token ?? null;
  } catch {
    return null;
  }
}

export async function getStoredUser(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.user ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.user) {
            setUser(parsed.user);
          }
          if (parsed?.token) {
            setToken(parsed.token);
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const login = (session: AuthSession) => {
    setUser(session.user);
    setToken(session.token);
    AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const updateUser = (partial: Partial<UserProfile>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      AsyncStorage.getItem(AUTH_STORAGE_KEY).then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          parsed.user = updated;
          AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
        }
      });
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user && !!token, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
