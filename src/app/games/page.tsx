'use client';

import Link from 'next/link';
import Adsense from '@/components/Adsense'
import React from 'react';

const subPages = [
  { name: 'Snake Game', path: '/games/snake' },
  { name: 'OctaShot', path: '/games/octashot' },
  { name: 'Music Destroyer', path: '/games/music-destroyer' },
  { name: 'UML Maker', path: '/games/schema-drawer' },
  { name: 'Flash Cards', path: '/games/flashcards' }
];

const GamesPage: React.FC = () => {
  const SLOT_GAMES_SIDE = process.env.NEXT_PUBLIC_ADSENSE_SLOT_GAMES_SIDE || ''
  return (
    <div style={{
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#121212',
      color: 'white',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between', // This will push the notes to the bottom
      textAlign: 'center'
    }}>
      <div className="side-ads" style={{ position: 'fixed', top: 120, left: 12, zIndex: 1200 }}>
        <div className="side-ads-inner" style={{ width: 160 }}>
          <Adsense slot={SLOT_GAMES_SIDE} responsive style={{ display: 'block' }} />
        </div>
      </div>
      <div className="side-ads" style={{ position: 'fixed', top: 120, right: 12, zIndex: 1200 }}>
        <div className="side-ads-inner" style={{ width: 160 }}>
          <Adsense slot={SLOT_GAMES_SIDE} responsive style={{ display: 'block' }} />
        </div>
      </div>
      <div> {/* Added a wrapper div for header and game list to keep them together at the top */}
        <header style={{ marginBottom: '40px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="games-header">
          <h1>Games & Extras:</h1>
          <Link href="/" passHref legacyBehavior>
            <a className="home-btn">Home</a>
          </Link>
        </header>
        <ul style={{
          listStyleType: 'none',
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '20px',
          width: '80%', // Control the width of the grid
          maxWidth: '1000px' // Max width for the grid
        }} className="games-grid">
          {subPages.map((page) => (
            <li key={page.path}>
              <Link href={page.path} passHref legacyBehavior>
                <a className="tool-card">
                  {page.name}
                </a>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 'auto', width: '80%', maxWidth: '1000px', paddingTop: '40px' }}>
        <h2 style={{
          color: '#e0e0e0',
          fontSize: '1.5em', // Made title smaller
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          marginBottom: '15px',
          textShadow: '1px 1px 3px rgba(0,0,0,0.5)'
        }}>
          Player Notes & Indications:
        </h2>
        <p style={{
          width: '100%',
          minHeight: '50px',
          padding: '15px',
          backgroundColor: '#121212', // Changed to page background color
          color: 'white',
          border: '1px solid #333',
          borderRadius: '8px',
          fontSize: '1.2em', // Made paragraph text bigger
          fontFamily: 'Arial, sans-serif',
          boxSizing: 'border-box',
          textAlign: 'left'
        }}>
          This is a catalog for small, made-only-for-fun and experimental purposes game projects, all made with NextJS code.
          I recommend testing out the snake game, made to be a fun twist from the classical snake games with appearing/dissapearing
          obstacles/walls, and a progressively decreasing HP system to keep the player engaged, along with simple yet cool items.

          Also, for the time being, the dungeon crawler game is not functional, but I plan to make it work properly in the near future.
        </p>
      </div>
      <style jsx>{`
        h1 {
          color: #e0e0e0; /* Lighter color for title */
          font-size: 3em; /* Larger font size */
          text-transform: uppercase; /* Uppercase text */
          letter-spacing: 2px; /* Spacing between letters */
          margin-bottom: 10px; /* Space below title */
          text-shadow: 2px 2px 4px rgba(0,0,0,0.5); /* Subtle text shadow */
        }
        p {
          color: #b0b0b0; /* Slightly lighter paragraph text */
          font-size: 1.1em;
        }
        .tool-card {
          background-color: #1e1e1e; 
          padding: 10px; 
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
          min-height: 100px; 
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .tool-card:hover {
          background-color: #2a2a2a; 
          transform: scale(1.05); 
        }
      `}</style>
      <style jsx>{`
        .home-btn {
          background-color: #1e1e1e;
          padding: 8px 12px;
          border-radius: 8px;
          color: white;
          text-decoration: none;
          transition: background-color 0.2s, transform 0.2s;
          border: none;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        .home-btn:hover {
          background-color: #2a2a2a;
          transform: translateY(-1px);
        }
      `}</style>
      <style jsx>{`
        @media (max-width: 1200px) {
          .side-ads { display: none; }
        }
        @media (max-width: 768px) {
          h1 {
            font-size: 2em;
          }
          .games-header {
            flex-direction: column;
            gap: 20px;
          }
          .games-grid {
            width: 95% !important;
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default GamesPage;
