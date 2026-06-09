"use client"
import App from '@/components/musicdestroyer/App';
import Adsense from '@/components/Adsense'
import Link from 'next/link'

export default function Page() {
  const SLOT_MUSIC_SIDE = process.env.NEXT_PUBLIC_ADSENSE_SLOT_MUSIC_SIDE || process.env.NEXT_PUBLIC_ADSENSE_SLOT_GAMES_SIDE || ''
  return (
    <div>
      {/* Top header with Home button */}
      <div style={{ position: 'fixed', top: 12, left: 12, right: 12, zIndex: 1300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Link href="/" legacyBehavior>
          <a className="btn btn-primary" style={{ textDecoration: 'none' }}>Home</a>
        </Link>
      </div>
      <div className="side-ads" style={{ position: 'fixed', top: 120, left: 12, zIndex: 1200 }}>
        <div className="side-ads-inner" style={{ width: 160 }}>
          <Adsense slot={SLOT_MUSIC_SIDE} responsive style={{ display: 'block' }} />
        </div>
      </div>
      <div className="side-ads" style={{ position: 'fixed', top: 120, right: 12, zIndex: 1200 }}>
        <div className="side-ads-inner" style={{ width: 160 }}>
          <Adsense slot={SLOT_MUSIC_SIDE} responsive style={{ display: 'block' }} />
        </div>
      </div>
      <App />
      <style jsx>{`
        @media (max-width: 1200px) {
          .side-ads { display: none; }
        }
      `}</style>
    </div>
  );
}
