'use client'
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import Adsense from '@/components/Adsense'
import { initSnakeGameEasterEgg, cleanupSnakeGameEasterEgg } from './api/snakegame/client-integration';
import SearchBar from '@/components/SearchBar'

const SPECIALIZATIONS = {
  s7: [
    { href: '/semester/s7_bigdata_ai', title: 'S7 - Big Data & AI' },
    { href: '/semester/s7_cybersecurity', title: 'S7 - Cybersecurity' },
    { href: '/semester/s7_cloud', title: 'S7 - Cloud' },
    { href: '/semester/s7_software', title: 'S7 - Software Engineering' },
  ],
  s8: [
    { href: '/semester/s8_bigdata_ai', title: 'S8 - Big Data & AI' },
    { href: '/semester/s8_cybersecurity', title: 'S8 - Cybersecurity' },
    { href: '/semester/s8_cloud', title: 'S8 - Cloud' },
    { href: '/semester/s8_software', title: 'S8 - Software Engineering' },
  ],
  s9: [
    { href: '/semester/s9_bigdata_ai', title: 'S9 - Big Data & AI' },
    { href: '/semester/s9_cybersecurity', title: 'S9 - Cybersecurity' },
    { href: '/semester/s9_cloud', title: 'S9 - Cloud' },
    { href: '/semester/s9_software', title: 'S9 - Software Engineering' },
  ],
} as const;


function VersionFooter() {
  const [version, setVersion] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const res = await fetch('/api/devnotes');
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.version === 'string') {
            setVersion(data.version);
          }
        }
      } catch (err) {
        console.error('Failed to load version from notes.json:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchVersion();
  }, []);

  return (
    <span>
      {loading ? 'Loading version…' : version ? `Version ${version}` : ''}
    </span>
  );
}
function Topnote() {
  const [topnote, setTopnote] = useState<string[] | string>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTopnote = async () => {
      try {
        const res = await fetch('/api/devnotes');
        if (res.ok) {
          const data = await res.json();
          if (data && data.topnote) {
            setTopnote(data.topnote);
          }
        }
      } catch (err) {
        console.error('Failed to load topnote from notes.json:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTopnote();
  }, []);

  if ((!topnote || (Array.isArray(topnote) && topnote.length === 0)) && !loading) return null;

  return (
    <div className="w-full text-center py-2 text-blue-400 font-bold whitespace-pre-wrap break-words">
      {loading ? 'Loading note...' :
        Array.isArray(topnote) ?
          topnote.map((note, index) => (
            <div key={index}>{note}</div>
          )) :
          topnote
      }
    </div>
  );
}

export default function HomePage() {
  const SLOT_HOME = process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME || ''

  const [userSession, setUserSession] = useState<any>(null);
  const [devNotes, setDevNotes] = useState<string>('');
  const [showDevNotes, setShowDevNotes] = useState(false);
  // Add layout toggle state: default to vertical (list)
  const [flags, setFlags] = useState<{ admin_screen_access: number; normal_login: number }>({ admin_screen_access: 1, normal_login: 1 });


  // Load persisted layout and fetch semesters on mount

  useEffect(() => {
    const sessionData = localStorage.getItem('userSession');
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        setUserSession(session);
      } catch (error) {
        console.error("Error parsing user session:", error);
      }
    }
    try {
      fetch('/api/data/parameters')
        .then((r) => r.json())
        .then((p) => {
          if (p && typeof p === 'object') setFlags({
            admin_screen_access: Number(p.admin_screen_access ?? 1),
            normal_login: Number(p.normal_login ?? 1),
          });
        })
        .catch(() => { });
    } catch { }

    initSnakeGameEasterEgg();

    return () => {
      cleanupSnakeGameEasterEgg();
    };
  }, []);

  const fetchDevNotes = async () => {
    try {
      console.log('Attempting to fetch notes.json...');
      const response = await fetch('/api/devnotes');
      console.log('Response status:', response.status);

      if (response.ok) {
        const jsonData = await response.json();
        console.log('JSON data loaded successfully');

        let htmlContent = `
          <h2>${jsonData.title}</h2>
          <div class="date-display">Last updated: ${jsonData.lastUpdated}</div>
          <h3>Current Version <span class="version">${jsonData.version}</span></h3>
        `;

        interface Section {
          title: string;
          items: string[];
        }

        jsonData.sections.forEach((section: Section) => {
          if (section.title === "Important Warnings") {
            htmlContent += `
              <div class="warning">
                <strong>${section.title}</strong>
                <div class="warning-content">
                  ${section.items.map((item: string) => `<p>${item}</p>`).join('')}
                </div>
              </div>
            `;
          } else {
            htmlContent += `
              <div class="section">
                <h3>${section.title}</h3>
                <div class="section-content">
                  ${section.items.map((item: string) => `<p>${item}</p>`).join('')}
                </div>
              </div>
            `;
          }
        });

        setDevNotes(htmlContent);
      } else {
        console.log('Failed to load notes.json');
        setDevNotes('<p>No development notes available. Please create a notes.json file in the data folder.</p>');
      }

      setShowDevNotes(true);
    } catch (error) {
      console.error('Error fetching dev notes:', error);
      setDevNotes('<p>Error loading development notes.</p>');
      setShowDevNotes(true);
    }
  };



  // Home page entrance buttons are hardcoded; contents load from semesters.json on each page

  return (
    <div className="main-container">


      <header className="semester-header">
        <Link href="/" className="site-title">
          <h1>Dynamic Open Archive</h1>
        </Link>
      </header>

      <div className="search-section">
        <SearchBar />
      </div>

      <Topnote />

      <div className="semesters-container">
        <div className="semesters-header">
          <h2>Semesters</h2>
        </div>

        <div className="semester-list">
          {/* Hardcoded entrance buttons; page contents read from semesters.json */}
          <Link href="/semester/1" style={{ textDecoration: 'none' }}>
            <div className="semester-item">
              <span className="semester-indicator"></span>
              <span className="semester-title">Semester 1</span>
            </div>
          </Link>
          <Link href="/semester/2" style={{ textDecoration: 'none' }}>
            <div className="semester-item">
              <span className="semester-indicator"></span>
              <span className="semester-title">Semester 2</span>
            </div>
          </Link>
          <Link href="/semester/3" style={{ textDecoration: 'none' }}>
            <div className="semester-item">
              <span className="semester-indicator"></span>
              <span className="semester-title">Semester 3</span>
            </div>
          </Link>
          <Link href="/semester/4" style={{ textDecoration: 'none' }}>
            <div className="semester-item">
              <span className="semester-indicator"></span>
              <span className="semester-title">Semester 4</span>
            </div>
          </Link>
          <Link href="/semester/5" style={{ textDecoration: 'none' }}>
            <div className="semester-item">
              <span className="semester-indicator"></span>
              <span className="semester-title">Semester 5</span>
            </div>
          </Link>
          <Link href="/semester/6" style={{ textDecoration: 'none' }}>
            <div className="semester-item">
              <span className="semester-indicator"></span>
              <span className="semester-title">Semester 6</span>
            </div>
          </Link>
        </div>

        {/* S7 Specializations Row */}
        <div className="specializations-section">
          <div className="specialization-row">
            {SPECIALIZATIONS.s7.map((item) => (
              <Link href={item.href} key={item.href} style={{ textDecoration: 'none' }}>
                <div className="semester-item">
                  <span className="semester-indicator"></span>
                  <span className="semester-title">{item.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* S8 Specializations Row */}
        <div className="specializations-section">
          <div className="specialization-row">
            {SPECIALIZATIONS.s8.map((item) => (
              <Link href={item.href} key={item.href} style={{ textDecoration: 'none' }}>
                <div className="semester-item">
                  <span className="semester-indicator"></span>
                  <span className="semester-title">{item.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* S9 Specializations Row */}
        <div className="specializations-section">
          <div className="specialization-row">
            {SPECIALIZATIONS.s9.map((item) => (
              <Link href={item.href} key={item.href} style={{ textDecoration: 'none' }}>
                <div className="semester-item">
                  <span className="semester-indicator"></span>
                  <span className="semester-title">{item.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>



      {/* Dev Notes Modal */}
      {showDevNotes && (
        <div className="dev-notes-modal">
          <div className="dev-notes-content">
            <div className="dev-notes-header">
              <h3>Development Notes</h3>
              <button
                className="close-button"
                onClick={() => setShowDevNotes(false)}
              >
                Close
              </button>
            </div>
            <div
              className="dev-notes-body"
              dangerouslySetInnerHTML={{ __html: devNotes }}
            />
          </div>
        </div>
      )}

      {/* Recommended tools section */}
      <div className="tools-section">
        <h2>Useful Tools / Links</h2>
        <div className="tools-grid">
          {/* App buttons at the top */}
          <Link href="/notepad" className="tool-card">
            Notepad
          </Link>
          <Link
            className="tool-card"
            href="/drawpad"
          >
            Drawpad
          </Link>
          <button className="tool-card" onClick={fetchDevNotes}>
            Dev Notes
          </button>

          {/* Link buttons after them */}
          <Link href="/games" className="tool-card" target="_blank" rel="noopener noreferrer">
            Games and Extras
          </Link>
          <a href="https://drive.google.com/drive/folders/11WJHRKmG4jKrcgWr_OTflGSMI2ZqX7II?usp=drive_link" className="tool-card" target="_blank" rel="noopener noreferrer">
            Extra Documents and Books
          </a>
          <a href="https://www.ilovepdf.com/ocr-pdf" className="tool-card" target="_blank" rel="noopener noreferrer">
            OCR Service for PDFs
          </a>
          <a href="https://texviewer.herokuapp.com/" className="tool-card" target="_blank" rel="noopener noreferrer">
            <div>TeX - Best LaTeX reader and PDF exporter</div>
          </a>
          <a href="https://claude.ai/new/" className="tool-card" target="_blank" rel="noopener noreferrer">
            <div>Claude - Best LLM AI for Academics</div>
          </a>
        </div>
        <h2 style={{ textAlign: 'center' }}>Email: contact@example.com</h2>
      </div>



      {/* Version indicator at the very bottom */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 24 }}>
        <div style={{ maxWidth: 1000, width: '100%', padding: '0 16px' }}>
          <Adsense slot={SLOT_HOME} responsive style={{ display: 'block', minHeight: 60 }} format="horizontal" />
        </div>
      </div>
      <footer className="version-footer" >
        <VersionFooter />
      </footer>

      <style jsx>{`
        .main-container {
          background-color:#000000;
          color: white;
          min-height: 100vh;
          font-family: Arial, sans-serif;
          display: flex;
          flex-direction: column;
          --tile-gap: 16px;
        }

        /* Header and title handled in globals, keep spacing consistent */
        .search-section {
          width: 100%;
          max-width: 1000px;
          margin: 20px auto 30px;
          padding: 0 16px;
        }

        .semesters-container {
          width: 100%;
          max-width: 1000px;
          margin: 0 auto;
          padding: 0 16px 24px;
        }

        .semesters-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 10px 0 16px;
        }

        .semester-list {
          list-style-type: none;
        }

        .semesters-container .semester-list {
          margin-bottom: var(--tile-gap);
        }

        .semester-list .semester-item {
          margin-bottom: var(--tile-gap);
        }
        .semester-item {
          background-color: #1e1e1e;
          padding-left: 16px;
          border-radius: 10px;
          color: white;
          text-decoration: none;
          transition: background-color 0.2s, transform 0.4s;
          display: flex;
          justify-content: flex-start;
          align-items: center;
          border: 1px solid #333;
          font-size: 16px;
          cursor: pointer;
          min-height: 88px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          gap: 15px;
-          max-width: 1000px;
+          width: 100%;
+          max-width: none;
        }

        .specializations-section {
          font-size: 16px;
          padding: 0 16px;
          min-height: 0;
        }
        .semester-item:hover {
          background-color: #2a2a2a;
          transform: scale(1.03);
        }

        .semester-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #4a90e2;
        }

        .semester-title {
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        /* Dev notes modal */
        .dev-notes-modal {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 16px;
        }

        .dev-notes-content {
          width: 100%;
          max-width: 900px;
          background-color: #1e1e1e;
          border: 1px solid #333;
          border-radius: 12px;
          box-shadow: 0 10px 24px rgba(0,0,0,0.5);
          overflow: hidden;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }

        .dev-notes-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background-color: #2a2a2a;
          border-bottom: 1px solid #444;
        }

        .dev-notes-header h3 {
          margin: 0;
        }

        .dev-notes-body {
          padding: 16px;
          color: #ddd;
          overflow-y: auto;
        }

        .tools-section {
          width: 100%;
          max-width: 1000px;
          margin: 10px auto 24px;
          padding: 0 16px;
        }

        .tools-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: var(--tile-gap);
          align-items: stretch;
          grid-auto-rows: 120px;
        }

        :global(.tool-card) {
          background-color: #1e1e1e;
          padding: 12px;
          border-radius: 10px;
          color: white;
          text-decoration: none;
          transition: background-color 0.2s, transform 0.4s;
          text-align: center;
          display: flex;
          justify-content: center;
          align-items: center;
          border: none;
          font-size: 16px;
          cursor: pointer;
          height: 95%;
          width: 100%;
          box-sizing: border-box;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }

        :global(.tool-card:hover) {
          background-color: #2a2a2a;
          transform: scale(1.05);
        }

        .specializations-section {
          width: 100%;
          max-width: 1000px;
          margin: 0 auto;
          min-height: 0; /* override earlier min-height to avoid extra vertical spacing */
          padding: 0;
        }

        /* Ensure consistent vertical gap between successive specialization rows */
        .specializations-section + .specializations-section {
          margin-top: var(--tile-gap);
        }
        .specializations-title {
          color: #e0e0e0;
          font-size: 1.2rem;
          letter-spacing: 0.8px;
          text-shadow: 1px 1px 3px rgba(0,0,0,0.4);
        }

        .specialization-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--tile-gap);
          justify-content: stretch;
          align-items: stretch;
        }

        .specialization-row .semester-item {
          width: 100%;
          max-width: none;
          min-height: 88px;
          margin-bottom: 0.8px;
        }

      @media (max-width: 1000px) {
          .specialization-row {
            grid-template-columns: 1fr;
            gap: var(--tile-gap);
            margin-bottom: var(--tile-gap);
          }
        }

      /* Feedback UI */
      .feedback-footer {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 16px;
        display: flex;
        justify-content: center;
        pointer-events: none; /* allow only button interaction */
        z-index: 1500;
      }
      .feedback-button {
        pointer-events: auto;
        color: white;
        border: none;
        border-radius: 9999px;
        padding: 10px 18px;
        font-weight: 600;
        cursor: pointer;
        /* animated gradient in dark blue tones */
        background: linear-gradient(135deg, #3a80d2 0%, #2f6ab3 50%, #3a80d2 100%);
        background-size: 200% 200%;
        box-shadow: 0 8px 18px rgba(0,0,0,0.35);
        transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1),
                    box-shadow 240ms ease,
                    background-position 300ms ease;
      }
      .feedback-button:hover {
        background-position: 100% 0%;
        transform: translateY(-2px) scale(1.06);
        box-shadow: 0 14px 32px rgba(0,0,0,0.45);
        animation: glowPulse 1.3s ease-in-out infinite alternate;
      }
      .feedback-button:active {
        transform: translateY(0) scale(0.98);
        box-shadow: 0 6px 16px rgba(0,0,0,0.35);
      }

      .feedback-modal {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        padding: 16px;
      }
      .feedback-content {
        width: 100%;
        max-width: 720px;
        background-color: #1e1e1e;
        border: 1px solid #333;
        border-radius: 12px;
        box-shadow: 0 10px 24px rgba(0,0,0,0.5);
        overflow: hidden;
      }
      .feedback-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background-color: #2a2a2a;
        border-bottom: 1px solid #444;
      }
      .feedback-body { padding: 16px; }
      .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
      .field select {
        padding: 8px;
        background-color: #333;
        color: white;
        border: 1px solid #555;
        border-radius: 6px;
      }
      .feedback-textarea {
        width: 100%;
        background-color: #111;
        color: #e6e6e6;
        border: 1px solid #444;
        border-radius: 6px;
        padding: 10px;
      }
      .actions { display: flex; align-items: center; }
      .word-count { color: #aaa; font-size: 12px; margin-top: 6px; }

      /* Send button: same look as .close-button, but light blue */
      .feedback-send-button {
        background-color: #3a80d2; /* light blue */
        color: white;
        border: none;
        border-radius: 6px;
        padding: 7px 11px; /* slightly smaller */
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        transition: background-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
        box-shadow: 0 6px 16px rgba(0,0,0,0.35);
      }
      .feedback-send-button:hover:not(:disabled) {
        filter: brightness(1.05);
        transform: translateY(-1px) scale(1.03);
        box-shadow: 0 6px 16px rgba(0,0,0,0.35);
      }

      .feedback-send-button:active:not(:disabled) {
        transform: translateY(0) scale(0.98);
        box-shadow: 0 6px 14px rgba(0,0,0,0.3);
      }
      .feedback-send-button:disabled {
        background-color: #3a80d2; /* darker blue when disabled */
        cursor: not-allowed;
        box-shadow: none;
      }

      @keyframes glowPulse {
        0% { box-shadow: 0 12px 28px rgba(0,0,0,0.40); }
        100% { box-shadow: 0 18px 40px rgba(0,0,0,0.52); }
      }
      `}</style>
    </div>

  );
}


