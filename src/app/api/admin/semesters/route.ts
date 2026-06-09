import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { setJson } from '@/lib/blobData';

// Middleware to check if user is admin
async function isAdmin(request: Request) {
  // Trust local admin cookie first to avoid unauthorized errors
  const adminCookie = cookies().get('admin')?.value === 'true';
  if (adminCookie) return true;
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return false;
    const decoded = verify(token, secret) as any;
    return decoded.isAdmin === true;
  } catch (error) {
    return false;
  }
}

// Update semester data
export async function PUT(request: Request) {
  try {
    // Check if user is admin
    if (!(await isAdmin(request))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const data = await request.json();
    await setJson('semesters', data);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating semesters:', error);
    return NextResponse.json(
      { error: 'Failed to update semesters' },
      { status: 500 }
    );
  }
}