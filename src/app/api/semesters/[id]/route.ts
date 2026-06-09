import { NextResponse } from 'next/server';
import { getLocalJson, setLocalJson } from '@/lib/blobData';
import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';

async function isAdmin(request: Request) {
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

// GET endpoint to retrieve semester data
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Helper to normalize any of the supported shapes into an array
    const normalize = (raw: any): any[] => {
      if (Array.isArray(raw)) return raw;
      if (raw && Array.isArray((raw as any).semesters)) return (raw as any).semesters;
      return [];
    };

    // Canonicalize IDs so that numeric, prefixed (e.g. "s5"), and
    // specialization aliases (s7/s8) resolve correctly.
    const canon = (id: string): string => {
      const v = String(id || '').trim().toLowerCase();
      if (v === '7' || v === 's7') return 's7_bigdata_ai';
      if (v === '8' || v === 's8') return 's8_bigdata_ai';
      // Support accidental numeric prefix like "s5" -> "5"
      if (/^s\d+$/.test(v)) return v.slice(1);
      return v;
    };

    // Local-only: read from local and return 404 if absent
    const local = getLocalJson<any>('semesters');
    if (!local) {
      return NextResponse.json({ error: 'Semesters data not found' }, { status: 404 });
    }
    const list = normalize(local);
    const semester = list.find((s: any) => canon(String(s.id)) === canon(params.id));
    if (!semester) {
      return NextResponse.json({ error: 'Semester not found' }, { status: 404 });
    }
    return NextResponse.json(semester);
  } catch (error) {
    console.error('Error fetching semester data from local file:', error);
    return NextResponse.json(
      { error: 'Failed to fetch semester data' },
      { status: 500 }
    );
  }
}

// PUT endpoint to update semester data
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Require admin privileges
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Get the updated semester data from the request
    const updatedSemesterData = await request.json();
    
    // Local-only: Read the current semesters data and normalize to array
    const raw = getLocalJson<any>('semesters');
    const semestersList: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as any)?.semesters)
        ? (raw as any).semesters
        : [];

    // Canonicalize IDs so updates match the same rules as GET
    const canon = (id: string): string => {
      const v = String(id || '').trim().toLowerCase();
      if (v === '7' || v === 's7') return 's7_bigdata_ai';
      if (v === '8' || v === 's8') return 's8_bigdata_ai';
      if (/^s\d+$/.test(v)) return v.slice(1);
      return v;
    };

    // Find the index of the semester to update
    const idx = semestersList.findIndex((s: any) => canon(String(s.id)) === canon(params.id));

    if (idx === -1) {
      // Add new semester entry
      semestersList.push({
        id: canon(params.id),
        title: updatedSemesterData.title || `Semester ${params.id}`,
        subjects: updatedSemesterData.subjects || []
      });
    } else {
      // Update existing semester entry
      semestersList[idx] = {
        ...semestersList[idx],
        ...updatedSemesterData,
        id: canon(params.id),
      };
    }

    // Persist locally in a consistent object shape
    setLocalJson('semesters', { semesters: semestersList });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = (error as any)?.message || 'Unknown error';
    console.error('Error updating semester data locally:', message, error);
    return NextResponse.json(
      { error: 'Failed to update semester data', details: message },
      { status: 500 }
    );
  }
}