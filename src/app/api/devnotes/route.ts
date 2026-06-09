import { NextResponse } from 'next/server';
import { getLocalJson, setLocalJson } from '@/lib/blobData';
import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';

async function isAdmin(request: Request) {
  // Trust local admin cookie first
  const adminCookie = cookies().get('admin')?.value === 'true';
  if (adminCookie) return true;
  // Fallback to Authorization header
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

export async function GET(request: Request) {
  try {
    // Local-only: read dev notes from local JSON
    const local = getLocalJson('notes');
    if (!local) return NextResponse.json({ error: 'Notes file not found' }, { status: 404 });
    return NextResponse.json(local);
  } catch (error) {
    console.error('Error reading notes from local file:', error);
    return NextResponse.json({ error: 'Failed to read notes data' }, { status: 500 });
  }
}

// Save dev notes locally
export async function PUT(request: Request) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    // Local-only persist
    setLocalJson('notes', body);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = (error as any)?.message || 'Unknown error';
    console.error('Error saving notes locally:', message, error);
    return NextResponse.json({ error: 'Failed to save notes', details: message }, { status: 500 });
  }
}