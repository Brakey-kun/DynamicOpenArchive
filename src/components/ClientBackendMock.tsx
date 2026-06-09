'use client'

import { useEffect } from 'react';

export default function ClientBackendMock() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const originalFetch = window.fetch;
    
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
      
      // Check if this is an API call
      const match = urlStr.match(/^(?:\/|https?:\/\/[^\/]+)?(\/api\/[a-zA-Z0-9_\-\/\[\]]+)(?:\?(.*))?$/);
      if (!match) {
        return originalFetch(input, init);
      }
      
      const apiPath = match[1];
      const method = (init?.method || 'GET').toUpperCase();
      
      const jsonResponse = (data: any, status = 200) => {
        return new Response(JSON.stringify(data), {
          status,
          headers: { 'Content-Type': 'application/json' }
        });
      };
      
      let body: any = null;
      if (init?.body) {
        try {
          body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
        } catch {}
      }
      
      try {
        // Mock Login
        if (apiPath === '/api/auth/login' && method === 'POST') {
          const { username, password } = body || {};
          const usersRaw = localStorage.getItem('mock_users');
          const users = usersRaw ? JSON.parse(usersRaw) : [
            { id: '1', username: 'admin', email: 'admin@example.com', password: 'admin', isAdmin: true }
          ];
          
          const user = users.find((u: any) => u.username === username && u.password === password);
          if (!user) {
            return jsonResponse({ error: 'Invalid credentials' }, 401);
          }
          
          return jsonResponse({
            token: 'mock-jwt-token',
            user: { username: user.username, isAdmin: user.isAdmin }
          });
        }
        
        // Mock Register
        if (apiPath === '/api/auth/register' && method === 'POST') {
          const { username, email, password } = body || {};
          if (!username || !email || !password) {
            return jsonResponse({ error: 'All fields are required' }, 400);
          }
          
          const usersRaw = localStorage.getItem('mock_users');
          const users = usersRaw ? JSON.parse(usersRaw) : [
            { id: '1', username: 'admin', email: 'admin@example.com', password: 'admin', isAdmin: true }
          ];
          
          if (users.some((u: any) => u.username === username)) {
            return jsonResponse({ error: 'Username already exists' }, 400);
          }
          
          const newUser = {
            id: Date.now().toString(),
            username,
            email,
            password,
            isAdmin: false
          };
          users.push(newUser);
          localStorage.setItem('mock_users', JSON.stringify(users));
          
          return jsonResponse({
            token: 'mock-jwt-token',
            user: { username: newUser.username, isAdmin: newUser.isAdmin }
          });
        }
        
        // Mock Data Routes (/api/data/:name)
        const dataMatch = apiPath.match(/^\/api\/data\/([a-zA-Z0-9_\-]+)$/);
        if (dataMatch) {
          const name = dataMatch[1];
          if (method === 'GET') {
            const local = localStorage.getItem(`mock_data_${name}`);
            if (local) return jsonResponse(JSON.parse(local));
            
            const fallbackPath = name === 'parameters' ? '/settings/parameters.json' : `/data/${name}.json`;
            const staticRes = await originalFetch(fallbackPath);
            if (staticRes.ok) {
              const data = await staticRes.json();
              localStorage.setItem(`mock_data_${name}`, JSON.stringify(data));
              return jsonResponse(data);
            }
            return jsonResponse({ error: 'Not found' }, 404);
          }
          
          if (method === 'PUT') {
            localStorage.setItem(`mock_data_${name}`, JSON.stringify(body));
            return jsonResponse({ ok: true });
          }
        }
        
        // Mock Dev Notes
        if (apiPath === '/api/devnotes') {
          if (method === 'GET') {
            const local = localStorage.getItem('mock_data_notes');
            if (local) return jsonResponse(JSON.parse(local));
            
            const staticRes = await originalFetch('/data/notes.json');
            if (staticRes.ok) {
              const data = await staticRes.json();
              localStorage.setItem('mock_data_notes', JSON.stringify(data));
              return jsonResponse(data);
            }
            return jsonResponse({ error: 'Not found' }, 404);
          }
          if (method === 'PUT') {
            localStorage.setItem('mock_data_notes', JSON.stringify(body));
            return jsonResponse({ success: true });
          }
        }
        
        // Mock Semester list
        if (apiPath === '/api/semesters' && method === 'GET') {
          const local = localStorage.getItem('mock_data_semesters');
          if (local) return jsonResponse(JSON.parse(local));
          
          const staticRes = await originalFetch('/data/semesters.json');
          if (staticRes.ok) {
            const data = await staticRes.json();
            localStorage.setItem('mock_data_semesters', JSON.stringify(data));
            return jsonResponse(data);
          }
          return jsonResponse({ semesters: [] });
        }
        
        // Mock Semester update/retrieve by ID
        const semesterMatch = apiPath.match(/^\/api\/semesters\/([a-zA-Z0-9_\-]+)$/);
        if (semesterMatch) {
          const id = semesterMatch[1];
          const canon = (val: string): string => {
            const v = String(val || '').trim().toLowerCase();
            if (v === '7' || v === 's7') return 's7_bigdata_ai';
            if (v === '8' || v === 's8') return 's8_bigdata_ai';
            if (/^s\d+$/.test(v)) return v.slice(1);
            return v;
          };
          
          const getSemestersList = async (): Promise<any[]> => {
            const local = localStorage.getItem('mock_data_semesters');
            if (local) {
              const parsed = JSON.parse(local);
              return Array.isArray(parsed) ? parsed : (parsed?.semesters || []);
            }
            const staticRes = await originalFetch('/data/semesters.json');
            if (staticRes.ok) {
              const parsed = await staticRes.json();
              return Array.isArray(parsed) ? parsed : (parsed?.semesters || []);
            }
            return [];
          };
          
          if (method === 'GET') {
            const list = await getSemestersList();
            const semester = list.find((s: any) => canon(s.id) === canon(id));
            if (!semester) return jsonResponse({ error: 'Not found' }, 404);
            return jsonResponse(semester);
          }
          
          if (method === 'PUT') {
            const list = await getSemestersList();
            const idx = list.findIndex((s: any) => canon(s.id) === canon(id));
            if (idx === -1) {
              list.push({
                id: canon(id),
                title: body.title || `Semester ${id}`,
                subjects: body.subjects || []
              });
            } else {
              list[idx] = {
                ...list[idx],
                ...body,
                id: canon(id)
              };
            }
            localStorage.setItem('mock_data_semesters', JSON.stringify({ semesters: list }));
            return jsonResponse({ success: true });
          }
        }
        
        // Mock Admin Semesters
        if (apiPath === '/api/admin/semesters' && method === 'PUT') {
          localStorage.setItem('mock_data_semesters', JSON.stringify(body));
          return jsonResponse({ success: true });
        }
        
        return jsonResponse({ error: 'Not implemented client-side' }, 501);
      } catch (err: any) {
        return jsonResponse({ error: 'Mock server error', details: err.message }, 500);
      }
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, []);
  
  return null;
}
