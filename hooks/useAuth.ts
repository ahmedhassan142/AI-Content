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
  usageCount: number;
  maxFreeGenerations: number;
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
  remainingGenerations: number;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  createGuestSession: () => Promise<void>;
  convertGuestToUser: (signupData: SignupData) => Promise<{ success: boolean; error?: string }>;
  trackGeneration: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const generateGuestId = () => {
  return `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // ONLY check for authenticated user, DO NOT auto-create guest session
    checkAuth();
    
    // Check for existing guest session in localStorage (only if user clicked guest button before)
    const storedGuest = localStorage.getItem('guestSession');
    if (storedGuest && !user) {
      const guest = JSON.parse(storedGuest);
      if (new Date(guest.expiresAt) > new Date()) {
        setGuestSession(guest);
      } else {
        localStorage.removeItem('guestSession');
      }
    }
    
    const interval = setInterval(() => {
      if (user) {
        refreshToken();
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      
      if (data.success) {
        setUser(data.user);
        // Clear guest session if user logs in
        setGuestSession(null);
        localStorage.removeItem('guestSession');
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const createGuestSession = async () => {
    const newGuestSession: GuestSession = {
      id: generateGuestId(),
      isGuest: true,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      usageCount: 0,
      maxFreeGenerations: 5,
    };
    
    setGuestSession(newGuestSession);
    localStorage.setItem('guestSession', JSON.stringify(newGuestSession));
    
    // Optional: Store in backend for analytics
    try {
      await fetch('/api/guest/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: newGuestSession.id }),
      });
    } catch (error) {
      console.error('Failed to save guest session:', error);
    }
  };

  const trackGeneration = async (): Promise<boolean> => {
    if (user) {
      return true;
    }
    
    if (guestSession) {
      if (guestSession.usageCount >= guestSession.maxFreeGenerations) {
        return false;
      }
      
      const updatedSession = {
        ...guestSession,
        usageCount: guestSession.usageCount + 1,
      };
      
      setGuestSession(updatedSession);
      localStorage.setItem('guestSession', JSON.stringify(updatedSession));
      
      return true;
    }
    
    return false;
  };

  const convertGuestToUser = async (signupData: SignupData) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData),
      });
      
      const data = await res.json();
      
      if (data.success) {
        if (guestSession) {
          try {
            await fetch('/api/guest/convert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                guestSessionId: guestSession.id,
                userId: data.user._id,
              }),
            });
          } catch (error) {
            console.error('Failed to transfer guest data:', error);
          }
          
          localStorage.removeItem('guestSession');
          setGuestSession(null);
        }
        
        router.push('/login?verified=please-check-your-email');
        return { success: true };
      }
      
      return { success: false, error: data.error || 'Signup failed' };
    } catch (error) {
      return { success: false, error: 'An error occurred. Please try again.' };
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setUser(data.user);
        setGuestSession(null);
        localStorage.removeItem('guestSession');
        router.push('/dashboard');
        return { success: true };
      }
      
      return { success: false, error: data.error || 'Login failed' };
    } catch (error) {
      return { success: false, error: 'An error occurred. Please try again.' };
    }
  };

  const signup = async (formData: SignupData) => {
    return convertGuestToUser(formData);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      // DO NOT auto-create guest session on logout
      // Clear guest session if exists
      setGuestSession(null);
      localStorage.removeItem('guestSession');
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const remainingGenerations = guestSession 
    ? guestSession.maxFreeGenerations - guestSession.usageCount 
    : Infinity;

  const contextValue: AuthContextType = {
    user,
    guestSession,
    loading,
    isGuest: !!guestSession && !user,
    remainingGenerations,
    login,
    signup,
    logout,
    refreshToken,
    createGuestSession,
    convertGuestToUser,
    trackGeneration,
  };

  return React.createElement(AuthContext.Provider, { value: contextValue }, children);
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext };