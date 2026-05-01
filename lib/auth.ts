import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';
const JWT_REFRESH_EXPIRES_IN = '30d';

export interface UserPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  isEmailVerified?: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Verify token with better error handling
export function verifyToken(token: string): UserPayload | null {
  if (!token || typeof token !== 'string') {
    console.error('Invalid token: token is not a string');
    return null;
  }
  
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// Generate access token
export function generateAccessToken(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Generate refresh token
export function generateRefreshToken(payload: { userId: string }): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

// Generate both tokens
export function generateTokenPair(payload: UserPayload): TokenPair {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken({ userId: payload.userId })
  };
}

// Verify access token
export function verifyAccessToken(token: string): UserPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }
  
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// Verify refresh token
export function verifyRefreshToken(token: string): { userId: string } | null {
  if (!token || typeof token !== 'string') {
    return null;
  }
  
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
  } catch (error) {
    console.error('Refresh token verification error:', error);
    return null;
  }
}

// Get token from request (cookies or Authorization header)
// Get token from request (cookies or Authorization header)
export function getTokenFromRequest(request: NextRequest): string | null {
  // Check cookies first
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  
  // Try to get access-token from cookies
  let token = cookies['access-token'] || null;
  
  // If not in cookies, check Authorization header
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  
  // Also check for auth-token (legacy)
  if (!token) {
    token = cookies['auth-token'] || null;
  }
  
  // Log for debugging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('Token found:', !!token);
  }
  
  return token;
}

// For backward compatibility - returns object with tokens
export function getTokensFromRequest(request: NextRequest): { accessToken: string | null; refreshToken: string | null } {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  
  return {
    accessToken: cookies['access-token'] || null,
    refreshToken: cookies['refresh-token'] || null
  };
}
// Set auth cookies in response
export function setAuthCookies(response: NextResponse, tokenPair: TokenPair): NextResponse {
  response.cookies.set('access-token', tokenPair.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
  
  response.cookies.set('refresh-token', tokenPair.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  });
  
  return response;
}

// Clear auth cookies
export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set('access-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  
  response.cookies.set('refresh-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  
  return response;
}

// Generate random token for email verification / password reset
export function generateRandomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Hash token for storage (SHA-256)
export function hashToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

// Middleware to protect API routes
export async function requireAuth(request: NextRequest): Promise<{ 
  authenticated: boolean; 
  user?: UserPayload; 
  response?: NextResponse 
}> {
  const { accessToken, refreshToken } = getTokenFromRequest(request);
  
  if (!accessToken) {
    return { authenticated: false };
  }
  
  // Verify access token
  const user = verifyAccessToken(accessToken);
  if (user) {
    return { authenticated: true, user };
  }
  
  // Access token expired, try refresh token
  if (refreshToken) {
    const refreshPayload = verifyRefreshToken(refreshToken);
    if (refreshPayload) {
      // Get user from database and generate new tokens
      // This should be implemented with your User model
      return { authenticated: false, response: NextResponse.json(
        { error: 'Token expired, please refresh' },
        { status: 401 }
      ) };
    }
  }
  
  return { authenticated: false };
}