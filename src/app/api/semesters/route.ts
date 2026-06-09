import { NextResponse } from 'next/server';
import { getLocalJson } from '@/lib/blobData';

// Get all semesters
export async function GET(request: Request) {
  try {
    // Local-only: read semesters from local JSON file
    const raw: any = getLocalJson<any>('semesters');
    let semesters: any[] = [];
    if (Array.isArray(raw)) {
      semesters = raw;
    } else if (raw && Array.isArray((raw as any).semesters)) {
      semesters = (raw as any).semesters;
    }
    return NextResponse.json({ semesters });
  } catch (error) {
    console.error('Error fetching semesters from local file:', error);
    return NextResponse.json(
      { error: 'Failed to fetch semesters' },
      { status: 500 }
    );
  }
}