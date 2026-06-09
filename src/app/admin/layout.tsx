'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if user is admin
    const sessionData = localStorage.getItem('userSession')
    let adminStatus = false

    if (sessionData) {
      try {
        const session = JSON.parse(sessionData)
        adminStatus = session.isAdmin === true
      } catch (error) {
        console.error("Error parsing user session:", error)
      }
    }

    setIsAdmin(adminStatus)

    try {
      fetch('/api/data/parameters')
        .then((r) => r.json())
        .then((p) => {
          const ok = Number(p?.admin_screen_access ?? 1) === 1
          setAllowed(ok)
          if (!ok) {
            setTimeout(() => {
              router.replace('/')
            }, 300)
          }
        })
        .catch(() => setAllowed(true))
    } catch {
      setAllowed(true)
    }

    // If not admin, redirect to Rick Roll after a brief delay
    if (!adminStatus) {
      setTimeout(() => {
        window.location.href = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      }, 1500) // 1.5 second delay
    }
  }, [router])

  if (isAdmin === null || allowed === null) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (allowed === false) {
    return null
  }
  if (isAdmin === false) {
    return (
      <div className="unauthorized-screen">
        <div className="no-message">NO</div>
        <div className="redirect-message">You are not authorized to access this page.</div>
      </div>
    )
  }

  // Only render children if user is admin
  return (
    <div>
      {children}
    </div>
  )

  // Styles for the loading and unauthorized screens
  return (
    <>
      <style jsx global>{`
        .loading-screen, .unauthorized-screen {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background-color: #121212;
          z-index: 9999;
        }

        .loading-spinner {
          border: 8px solid #333;
          border-top: 8px solid #e74c3c;
          border-radius: 50%;
          width: 60px;
          height: 60px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .no-message {
          font-size: 15vw;
          font-weight: bold;
          color: #e74c3c;
          text-align: center;
          animation: pulse 1s infinite alternate;
        }

        .redirect-message {
          margin-top: 20px;
          font-size: 1.5rem;
          color: white;
        }

        @keyframes pulse {
          from { transform: scale(1); }
          to { transform: scale(1.1); }
        }
      `}</style>
      {children}
    </>
  )
}