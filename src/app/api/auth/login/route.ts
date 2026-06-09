import { NextResponse } from 'next/server';
import { sign } from 'jsonwebtoken';
import { getEncryptedJsonLocal } from '@/lib/secureData';
import { cookies } from 'next/headers';
import { verifyPassword } from '@/lib/auth';
import { getLocalJson } from '@/lib/blobData';

export async function POST(request: Request) {
  try {
    try {
      const p = getLocalJson<any>('parameters');
      const enabled = Number(p?.normal_login ?? 1) === 1;
      if (!enabled) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    } catch {}
    const { username, password } = await request.json();
    
    // Local-only read of users.json (no online/blob calls)
    const usersData = await getEncryptedJsonLocal<any>('users');
    const users = usersData?.users || [];
    
    // Find the user
    const user = users.find((u: any) => u.username === username && verifyPassword(password, String(u.password || '')));
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Create a JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is missing');
    }
    const token = sign(
      { 
        id: user.id, 
        username: user.username,
        isAdmin: user.isAdmin || false
      },
      secret,
      { expiresIn: '7d' }
    );
    
    const res = NextResponse.json({
      token,
      user: {
        username: user.username,
        isAdmin: user.isAdmin || false
      }
    });
    // Set a simple admin session cookie to avoid future unauthorized checks
    try {
      if (user.isAdmin) {
        res.cookies.set('admin', 'true', {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        });
      }
    } catch {}
    return res;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}