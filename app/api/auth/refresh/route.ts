import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, generateTokenPair, setAuthCookies, getTokensFromRequest } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(request: NextRequest) {
  try {
    // Use getTokensFromRequest to get both tokens as an object
    const { refreshToken } = getTokensFromRequest(request);
    
    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'No refresh token provided' },
        { status: 401 }
      );
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    await connectDB();
    
    // Get user from database
    const user = await User.findById(decoded.userId);
    
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
      message: 'Tokens refreshed successfully'
    });

    // Set new cookies
    return setAuthCookies(response, tokenPair);
    
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}