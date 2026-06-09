import { NextResponse } from 'next/server';
import { sign } from 'jsonwebtoken';
import { setJson } from '@/lib/blobData';
import { getEncryptedJsonLocal, setEncryptedJsonLocal } from '@/lib/secureData';
import { hashPassword } from '@/lib/auth';
import { getLocalJson } from '@/lib/blobData';

// Define the user interface
interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  isAdmin: boolean;
}

// Define the users data structure
interface UsersData {
  users: User[];
}

export async function POST(request: Request) {
  try {
    try {
      const p = getLocalJson<any>('parameters');
      const enabled = Number(p?.normal_login ?? 1) === 1;
      if (!enabled) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    } catch {}
    const { username, email, password } = await request.json();
    
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }
    
    // Local-only users management
    let users: UsersData = (await getEncryptedJsonLocal<UsersData>('users')) || { users: [] };
    
    // Check if username already exists
    if (users.users.some((u) => u.username === username)) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }
    
    // Check if email already exists
    if (users.users.some((u) => u.email === email)) {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 400 }
      );
    }
    
    // Add new user
    const newUser: User = {
      id: Date.now().toString(),
      username,
      email,
      password: hashPassword(password),
      isAdmin: false
    };
    
    users.users.push(newUser);

    // Save updated users encrypted locally (no blob writes)
    await setEncryptedJsonLocal('users', users);
    
    // Create a JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is missing');
    }
    const token = sign(
      { 
        id: newUser.id, 
        username: newUser.username,
        isAdmin: newUser.isAdmin
      },
      secret,
      { expiresIn: '7d' }
    );
    
    return NextResponse.json({
      token,
      user: {
        username: newUser.username,
        isAdmin: newUser.isAdmin
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}