'use client';

import React, { useEffect, useRef, useState } from 'react';
import { OctaShotGame } from './octashot-game';
import Link from 'next/link';
import { loadSave, save as saveLS, exportJSON, importJSON } from './save';

const OctaShotPage: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [saveData, setSaveData] = useState<any>(null);
  const [keyboardLayout, setKeyboardLayout] = useState<'azerty' | 'qwerty'>('azerty');
  const gameRef = useRef<OctaShotGame | null>(null);

  useEffect(() => {
    setSaveData(loadSave());
  }, []);

  useEffect(() => {
    if (!started) return;
    if (typeof window !== 'undefined' && ref.current) {
      if (!gameRef.current) {
        const container = document.createElement('div');
        container.id = 'octashot-canvas-container';
        ref.current.appendChild(container);
        gameRef.current = new OctaShotGame(container);
        gameRef.current.setKeyboardLayout(keyboardLayout);
      }
    }
    return () => {
      if (gameRef.current) { gameRef.current.destroy(); gameRef.current = null; }
      const c = ref.current?.querySelector('#octashot-canvas-container');
      if (c && ref.current) ref.current.removeChild(c);
    };
  }, [started, keyboardLayout]);

  const handleExport = () => {
    exportJSON(loadSave());
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importJSON(file);
      saveLS(data);
      setSaveData(loadSave());
    } catch {}
  };

  const startGame = () => { const s = loadSave(); s.level = 1; s.hp = s.maxHp; saveLS(s); setSaveData(s); setStarted(true); };
  const backToMenu = () => { setStarted(false); setSaveData(loadSave()); };

  const switchKeyboardLayout = (layout: 'azerty' | 'qwerty') => {
    setKeyboardLayout(layout);
    if (gameRef.current) {
      gameRef.current.setKeyboardLayout(layout);
    }
  };

  const Menu = (
    <div style={{ 
      width: '100%', 
      minHeight: '100vh', 
      position: 'relative', 
      background: 'linear-gradient(135deg, #0a1929 0%, #1a237e 50%, #0d47a1 100%)',
      color: 'white',
      overflow: 'hidden'
    }}>
      {/* Animated background elements */}
      <div className="ocean-bubbles">
        <div className="bubble bubble-1"></div>
        <div className="bubble bubble-2"></div>
        <div className="bubble bubble-3"></div>
        <div className="bubble bubble-4"></div>
        <div className="bubble bubble-5"></div>
      </div>
      
      <header style={{ 
        padding: '20px 30px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        borderBottom: '2px solid rgba(0, 150, 255, 0.3)'
      }}>
        <h1 style={{ 
          fontSize: '2.2rem', 
          letterSpacing: '2px',
          background: 'linear-gradient(45deg, #00e5ff, #0091ea)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 0 20px rgba(0, 229, 255, 0.5)',
          fontWeight: 'bold'
        }}>
          👹 OctaShot
        </h1>
        <Link href="/games" passHref legacyBehavior>
          <a className="home-btn">← Back to Games</a>
        </Link>
      </header>

      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: '20px', 
        paddingTop: '40px',
        position: 'relative',
        zIndex: 2
      }}>
        {/* Main Game Controls Section */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '20px',
          marginBottom: '20px'
        }}>
          {/* Big Green Start Button */}
          <button 
             onClick={startGame} 
             className="start-game-btn"
           >
             START GAME
           </button>
          
          {/* Settings Row */}
          <div className="settings-row">
            <div className="keyboard-layout-section">
              <span className="settings-label">⌨️ Controls:</span>
              <div className="layout-buttons">
                <button 
                  onClick={() => switchKeyboardLayout('azerty')} 
                  className={`layout-btn ${keyboardLayout === 'azerty' ? 'active' : ''}`}
                >
                  AZERTY
                </button>
                <button 
                  onClick={() => switchKeyboardLayout('qwerty')} 
                  className={`layout-btn ${keyboardLayout === 'qwerty' ? 'active' : ''}`}
                >
                  QWERTY
                </button>
              </div>
            </div>
            
            <button onClick={handleExport} className="settings-btn">
              📤 Export Save
            </button>
            
            <label className="settings-btn" style={{ cursor: 'pointer' }}>
              📥 Import Save
              <input type="file" accept="application/json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Stats Card */}
        <div className="menu-card" style={{ width: 'min(600px, 90vw)' }}>
          <h2 style={{ 
            textAlign: 'center', 
            marginBottom: '20px',
            background: 'linear-gradient(45deg, #00e5ff, #0091ea)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: '1.5rem'
          }}>
            🏆 Your Progress
          </h2>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-icon">⚔️</span>
              <span className="stat-label">Total Kills</span>
              <span className="stat-value">{saveData ? saveData.stats.kills : '—'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">👑</span>
              <span className="stat-label">Boss Kills</span>
              <span className="stat-value">{saveData ? saveData.stats.bosses : '—'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">🎯</span>
              <span className="stat-label">Shots Fired</span>
              <span className="stat-value">{saveData ? saveData.stats.shots : '—'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">⭐</span>
              <span className="stat-label">Score</span>
              <span className="stat-value">{saveData ? saveData.stats.score : '—'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">🏔️</span>
              <span className="stat-label">Max Level</span>
              <span className="stat-value">{saveData ? (saveData.maxLevel || 1) : '—'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">💀</span>
              <span className="stat-label">Max Kills</span>
              <span className="stat-value">{saveData ? (saveData.maxKills || 0) : '—'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">👹</span>
              <span className="stat-label">Max Bosses</span>
              <span className="stat-value">{saveData ? (saveData.maxBosses || 0) : '—'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">🌟</span>
              <span className="stat-label">Max Score</span>
              <span className="stat-value">{saveData ? (saveData.maxScore || 0) : '—'}</span>
            </div>
          </div>
          
          <div style={{ marginTop: '25px' }}>
            <h3 style={{ 
              margin: '0 0 15px 0', 
              textAlign: 'center',
              color: '#00e5ff',
              fontSize: '1.2rem'
            }}>
              🎁 Items Collected
            </h3>
            <div className="items-grid">
              <div className="item-stat"><span>❤️ Hearts</span> <span>{saveData ? saveData.stats.items.heart : '—'}</span></div>
              <div className="item-stat"><span>🍎 Apples</span> <span>{saveData ? saveData.stats.items.apple : '—'}</span></div>
              <div className="item-stat"><span>🛡️ Shields</span> <span>{saveData ? saveData.stats.items.shield : '—'}</span></div>
              <div className="item-stat"><span>🎯 Snipers</span> <span>{saveData ? saveData.stats.items.sniper : '—'}</span></div>
              <div className="item-stat"><span>🎨 Skins</span> <span>{saveData ? saveData.stats.items.skin : '—'}</span></div>
              <div className="item-stat"><span>❄️ Freeze</span> <span>{saveData ? saveData.stats.items.freeze : '—'}</span></div>
              <div className="item-stat"><span>🔄 Reflector</span> <span>{saveData ? saveData.stats.items.reflector : '—'}</span></div>
              <div className="item-stat"><span>⚡ Piercer</span> <span>{saveData ? saveData.stats.items.piercer : '—'}</span></div>
              <div className="item-stat"><span>💥 Burst</span> <span>{saveData ? saveData.stats.items.burst : '—'}</span></div>
              <div className="item-stat"><span>🌀 Siphon</span> <span>{saveData ? saveData.stats.items.siphon : '—'}</span></div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        
        @keyframes bubble {
          0% { transform: translateY(100vh) scale(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100px) scale(1); opacity: 0; }
        }
        
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 229, 255, 0.3); }
          50% { box-shadow: 0 0 40px rgba(0, 229, 255, 0.6); }
        }

        .ocean-bubbles {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }

        .bubble {
          position: absolute;
          background: radial-gradient(circle, rgba(0, 229, 255, 0.3) 0%, rgba(0, 145, 234, 0.1) 100%);
          border-radius: 50%;
          animation: bubble 8s infinite linear;
        }

        .bubble-1 { width: 40px; height: 40px; left: 10%; animation-delay: 0s; animation-duration: 8s; }
        .bubble-2 { width: 60px; height: 60px; left: 20%; animation-delay: 2s; animation-duration: 10s; }
        .bubble-3 { width: 30px; height: 30px; left: 70%; animation-delay: 4s; animation-duration: 7s; }
        .bubble-4 { width: 50px; height: 50px; left: 80%; animation-delay: 6s; animation-duration: 9s; }
        .bubble-5 { width: 35px; height: 35px; left: 50%; animation-delay: 1s; animation-duration: 11s; }

        .home-btn { 
          color: #00e5ff; 
          text-decoration: none; 
          border: 2px solid #00e5ff; 
          padding: 10px 20px; 
          border-radius: 25px;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          font-weight: 600;
        }
        .home-btn:hover {
          background: rgba(0, 229, 255, 0.2);
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0, 229, 255, 0.3);
        }

        .start-game-btn {
          background: linear-gradient(135deg, #00c853 0%, #4caf50 50%, #8bc34a 100%);
          color: white;
          border: none;
          border-radius: 20px;
          padding: 20px 50px;
          font-size: 1.8rem;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 8px 25px rgba(0, 200, 83, 0.4);
          text-transform: uppercase;
          letter-spacing: 2px;
          animation: glow 2s infinite;
        }
        .start-game-btn:hover {
          transform: translateY(-5px) scale(1.05);
          box-shadow: 0 15px 35px rgba(0, 200, 83, 0.6);
          background: linear-gradient(135deg, #00e676 0%, #66bb6a 50%, #aed581 100%);
        }
        .start-game-btn:active {
          transform: translateY(-2px) scale(1.02);
        }

        .settings-row {
          display: flex;
          gap: 20px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: center;
          padding: 15px 25px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 15px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 229, 255, 0.2);
        }

        .keyboard-layout-section {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .settings-label {
          font-size: 14px;
          color: #00e5ff;
          font-weight: 600;
        }

        .layout-buttons {
          display: flex;
          gap: 5px;
        }

        .layout-btn { 
          background: rgba(51, 51, 51, 0.8); 
          color: #CCC; 
          border: 1px solid #555; 
          border-radius: 8px; 
          padding: 6px 12px; 
          font-size: 12px; 
          cursor: pointer; 
          transition: all 0.3s ease;
          backdrop-filter: blur(5px);
        }
        .layout-btn:hover { 
          background: rgba(68, 68, 68, 0.9); 
          color: #FFF; 
          transform: translateY(-1px);
        }
        .layout-btn.active { 
          background: linear-gradient(45deg, #0066CC, #0088FF); 
          color: #FFF; 
          border-color: #0088FF;
          box-shadow: 0 0 10px rgba(0, 136, 255, 0.5);
        }

        .settings-btn {
          background: rgba(34, 34, 34, 0.8);
          color: #EEE;
          border: 1px solid rgba(68, 68, 68, 0.8);
          border-radius: 10px;
          padding: 10px 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          backdrop-filter: blur(5px);
          font-size: 14px;
        }
        .settings-btn:hover {
          background: rgba(68, 68, 68, 0.9);
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
          border-color: #00e5ff;
        }

        .menu-card { 
          background: rgba(26, 26, 26, 0.9); 
          padding: 25px; 
          border-radius: 20px;
          backdrop-filter: blur(15px);
          border: 2px solid rgba(0, 229, 255, 0.2);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
          border: 1px solid rgba(0, 229, 255, 0.1);
          transition: all 0.3s ease;
        }
        .stat-item:hover {
          background: rgba(0, 229, 255, 0.1);
          transform: translateY(-2px);
        }

        .stat-icon {
          font-size: 1.2rem;
          min-width: 25px;
        }

        .stat-label {
          flex: 1;
          font-size: 14px;
          color: #CCC;
        }

        .stat-value {
          font-weight: bold;
          color: #00e5ff;
          font-size: 16px;
        }

        .items-grid { 
          display: grid; 
          grid-template-columns: repeat(2, 1fr); 
          gap: 12px; 
          margin-top: 15px; 
        }

        .item-stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          border: 1px solid rgba(0, 229, 255, 0.1);
          transition: all 0.3s ease;
        }
        .item-stat:hover {
          background: rgba(0, 229, 255, 0.1);
          transform: translateX(5px);
        }
        .item-stat span:last-child {
          color: #00e5ff;
          font-weight: bold;
        }
      `}</style>
    </div>
  );

  return (
    <div style={{ width: '100%', minHeight: '100vh', position: 'relative' }}>
      {!started ? Menu : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div ref={ref} style={{ width: '100%', minHeight: '80vh' }} />
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={backToMenu} className="tool-card">Back to Menu</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OctaShotPage;