'use client';

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isEmailVerified: boolean;
  phone?: string;
  createdAt?: string;
}

export interface GuestSession {
  id: string;
  isGuest: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface SignupData {
  name: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
}

export interface AuthContextType {
  user: User | null;
  guestSession: GuestSession | null;
  loading: boolean;
  isGuest: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  createGuestSession: () => Promise<void>;
  convertGuestToUser: (signupData: SignupData) => Promise<{ success: boolean; error?: string }>;
  getAuthHeader: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const generateGuestId = () => `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
const TOKEN_KEY = 'accessToken';

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}
function clearStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    const storedGuest = localStorage.getItem('guestSession');
    if (storedGuest && !user) {
      try {
        const guest = JSON.parse(storedGuest);
        if (new Date(guest.expiresAt) > new Date()) setGuestSession(guest);
        else localStorage.removeItem('guestSession');
      } catch { localStorage.removeItem('guestSession'); }
    }
    const interval = setInterval(() => { if (user) refreshToken(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkAuth = async () => {
    try {
      const headers: Record<string, string> = {};
      const token = getStoredToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/auth/me', { headers });
      const data = await res.json();
      if (data.success) { setUser(data.user); setGuestSession(null); localStorage.removeItem('guestSession'); }
      else { clearStoredToken(); setUser(null); }
    } catch { setUser(null); } finally { setLoading(false); }
  };

  const createGuestSession = async () => {
    const newGuest: GuestSession = { id: generateGuestId(), isGuest: true, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7*24*60*60*1000).toISOString() };
    setGuestSession(newGuest);
    localStorage.setItem('guestSession', JSON.stringify(newGuest));
    try { await fetch('/api/guest/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: newGuest.id }) }); } catch {}
  };

  const convertGuestToUser = async (signupData: SignupData) => {
    try {
      const res = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(signupData) });
      const data = await res.json();
      if (data.success) { if (guestSession) { localStorage.removeItem('guestSession'); setGuestSession(null); } router.push('/login?verified=please-check-your-email'); return { success: true }; }
      return { success: false, error: data.error || 'Signup failed' };
    } catch { return { success: false, error: 'An error occurred.' }; }
  };

  const refreshToken = async (): Promise<boolean> => {
    if (!user) return false;
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (data.success && data.accessToken) {
        setStoredToken(data.accessToken);
        return true;
      }
      return !!data.success;
    } catch { return false; }
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (data.success) { setUser(data.user); setGuestSession(null); localStorage.removeItem('guestSession'); if (data.accessToken) setStoredToken(data.accessToken); window.location.href = '/dashboard'; return { success: true }; }
      return { success: false, error: data.error || 'Login failed' };
    } catch { return { success: false, error: 'An error occurred.' }; }
  };

  const signup = async (formData: SignupData) => convertGuestToUser(formData);

  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    setUser(null); setGuestSession(null); clearStoredToken(); localStorage.removeItem('guestSession'); router.push('/');
  };

  const getAuthHeader = (): Record<string, string> => {
    const token = getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const contextValue: AuthContextType = { user, guestSession, loading, isGuest: !!guestSession && !user, login, signup, logout, refreshToken, createGuestSession, convertGuestToUser, getAuthHeader };
  return React.createElement(AuthContext.Provider, { value: contextValue }, children);
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
export { AuthContext };
