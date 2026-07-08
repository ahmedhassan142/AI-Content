import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { generateTokenPair, setAuthCookies } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    console.log('Login attempt for email:', body.email);

    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user - make sure to include password field
    const user = await User.findOne({ email: body.email.toLowerCase() }).select('+password');
    
    if (!user) {
      console.log('User not found:', body.email.toLowerCase());
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    console.log('User found:', user.email);
    console.log('User has password:', !!user.password);
    console.log('Is email verified:', user.isEmailVerified);
    console.log('Is active:', user.isActive);

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated. Please contact support.' },
        { status: 401 }
      );
    }

    // Check if email is verified (optional - can be disabled for testing)
    // if (!user.isEmailVerified) {
    //   return NextResponse.json(
    //     { 
    //       success: false, 
    //       error: 'Please verify your email address first.',
    //       needsVerification: true 
    //     },
    //     { status: 401 }
    //   );
    // }

    // Check password
    const isValidPassword = await user.comparePassword(body.password);
    
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token pair (access + refresh)
    const tokenPair = generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      isEmailVerified: user.isEmailVerified || false
    });

    console.log('Tokens generated successfully');

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified || false,
        phone: user.phone
      },
      accessToken: tokenPair.accessToken,
    });

    return setAuthCookies(response, tokenPair, request);
    
  } catch (error: any) {
    console.error('Login error details:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}