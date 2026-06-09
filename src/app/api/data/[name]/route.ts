import { NextResponse } from 'next/server';
import { getJson, setJson, getLocalJson, setLocalJson } from '@/lib/blobData';

// GET /api/data/:name -> returns JSON blob contents
export async function GET(
  req: Request,
  { params }: { params: { name: string } }
) {
  try {
    const source = (req.headers.get('x-data-source') || '').toLowerCase();
    const name = params.name;
    if (source === 'local') {
      const local = getLocalJson(name);
      if (!local) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(local);
    }
    const json = await getJson(name);
    if (json) return NextResponse.json(json);
    const local = getLocalJson(name);
    if (local) return NextResponse.json(local);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

// PUT /api/data/:name -> replaces JSON blob contents
export async function PUT(
  req: Request,
  { params }: { params: { name: string } }
) {
  const { name } = params;

  // Simple write protection using an admin token header
  const adminToken = process.env.ADMIN_TOKEN;
  const provided = req.headers.get('x-admin-token');
  if (!adminToken || provided !== adminToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const source = (req.headers.get('x-data-source') || '').toLowerCase();
    if (source === 'local') {
      setLocalJson(name, body);
    } else {
      await setJson(name, body);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = (err as any)?.message || 'Unknown error';
    console.error('Blob save error:', message, err);
    return NextResponse.json({ error: 'Failed to save', details: message }, { status: 500 });
  }
}