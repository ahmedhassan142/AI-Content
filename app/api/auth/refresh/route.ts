import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, verifyRefreshToken, generateTokenPair, setAuthCookies, getTokenFromRequest } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(request: NextRequest) {
  try {
    // Try refresh token from cookie first
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    let refreshToken = cookies['refresh-token'] || null;

    // If no refresh token cookie, fall back to access token from Authorization header
    // (in preview environments, cookies don't survive the proxy, so we use the
    // access token's userId to issue a fresh token pair)
    let userId: string | null = null;

    if (refreshToken) {
      const decoded = verifyRefreshToken(refreshToken);
      if (decoded) userId = decoded.userId;
    }

    if (!userId) {
      const accessToken = getTokenFromRequest(request);
      if (accessToken) {
        const decoded = verifyToken(accessToken);
        if (decoded) userId = decoded.userId;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'No valid token provided' },
        { status: 401 }
      );
    }

    await connectDB();

    const user = await User.findById(userId);

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: 'User not found or inactive' },
        { status: 401 }
      );
    }

    // Generate new token pair
    const tokenPair = generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      isEmailVerified: user.isEmailVerified
    });

    const response = NextResponse.json({
      success: true,
      message: 'Tokens refreshed successfully',
      accessToken: tokenPair.accessToken,
    });

    return setAuthCookies(response, tokenPair, request);

  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
