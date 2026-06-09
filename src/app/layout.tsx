import type { Metadata } from 'next'
import './globals.css'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'Dynamic Open Archive',
  description: 'Access educational materials for all semesters. Claude - Best AI for schoolwork, Games, OCR Service for PDFs, Extra Documents and Books, Dev Notes, Notepad',
  keywords: 'Dynamic Open Archive, good-grades, academic archive, course explorer, educational materials, Claude AI, schoolwork, OCR, PDF service',
  authors: [{ name: 'Dynamic Open Archive' }],
  openGraph: {
    title: 'Dynamic Open Archive',
    description: 'Access educational materials for all semesters. Claude - Best AI for schoolwork, Games, OCR Service for PDFs, Extra Documents and Books, Dev Notes, Notepad',
    url: 'https://www.n-informatique.top',
    siteName: 'Dynamic Open Archive',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dynamic Open Archive',
    description: 'Access educational materials for all semesters. Claude - Best AI for schoolwork, Games, OCR Service for PDFs, Extra Documents and Books, Dev Notes, Notepad',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const adsClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#003366" />
        {adsClient && (
          <Script
            id="google-adsense"
            strategy="afterInteractive"
            async
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsClient}`}
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  )
}
