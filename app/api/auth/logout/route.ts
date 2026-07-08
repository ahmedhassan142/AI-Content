// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully'
  });

  // Clear auth cookies (access-token, refresh-token) with proper SameSite settings
  clearAuthCookies(response, request);

  // Also clear the legacy 'auth-token' cookie with matching settings
  const forwardedProto = request?.headers.get('x-forwarded-proto') || '';
  const isHttps = process.env.NODE_ENV === 'production' || forwardedProto.includes('https');
  const sameSite = isHttps ? 'none' : 'lax';

  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: isHttps,
    sameSite,
    maxAge: 0,
    path: '/',
  });

  return response;
}
