import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Content from '@/models/Content';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

// ✅ ADD THIS GET METHOD (for fetching single content)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    // Await params to get the id (Next.js 15 fix)
    const { id } = await params;
    
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Find the content and ensure it belongs to the user
    const content = await Content.findOne({
      _id: id,
      userId: decoded.userId,
    });
    
    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      content: {
        _id: content._id,
        title: content.title,
        content: content.content,
        type: content.type,
        tone: content.tone,
        length: content.length,
        language: content.language,
        seoKeywords: content.seoKeywords,
        plagiarismScore: content.plagiarismScore,
        isFavorite: content.isFavorite,
        createdAt: content.createdAt,
      },
    });
    
  } catch (error: any) {
    console.error('Get content error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch content' },
      { status: 500 }
    );
  }
}

// Your existing PUT method
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id } = await params;
    
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const body = await request.json();
    const { isFavorite, title, content } = body;
    
    const existingContent = await Content.findOne({
      _id: id,
      userId: decoded.userId,
    });
    
    if (!existingContent) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }
    
    if (title !== undefined) existingContent.title = title;
    if (content !== undefined) existingContent.content = content;
    if (typeof isFavorite === 'boolean') existingContent.isFavorite = isFavorite;
    
    await existingContent.save();
    
    return NextResponse.json({
      success: true,
      content: existingContent,
      message: `Content updated successfully`
    });
    
  } catch (error: any) {
    console.error('Update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update content' },
      { status: 500 }
    );
  }
}

// Your existing DELETE method
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id } = await params;
    
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const result = await Content.deleteOne({
      _id: id,
      userId: decoded.userId,
    });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Content deleted successfully',
    });
    
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete content' },
      { status: 500 }
    );
  }
}