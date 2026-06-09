'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { isAdEligiblePath, adsGloballyEnabled } from '@/lib/adPolicy'

type Props = {
  slot?: string
  style?: React.CSSProperties
  format?: string
  responsive?: boolean
  className?: string
}

export default function Adsense({ slot, style, format, responsive, className }: Props) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  const pathname = usePathname() || '/'
  // <ins> elements are represented by HTMLModElement in the DOM typings
  const insRef = useRef<HTMLModElement | null>(null)
  const eligible = Boolean(client && slot && adsGloballyEnabled() && isAdEligiblePath(pathname))

  useEffect(() => {
    if (client && !slot) {
      console.warn('AdSense: Slot ID missing for ad unit. Ads will not render. Please check your environment variables.')
    }
  }, [client, slot])

  useEffect(() => {
    if (!eligible) return
    try {
      const el = insRef.current
      const status = el?.getAttribute('data-ad-status')
      if (status !== 'done') {
        // @ts-expect-error adsbygoogle global injected by Adsense script
        (window.adsbygoogle = window.adsbygoogle || []).push({})
      }
    } catch { }
  }, [eligible])
  // Failsafe: only render when eligible
  if (!eligible) return null
  return (
    <ins
      ref={insRef}
      className={`adsbygoogle${className ? ' ' + className : ''}`}
      style={style || { display: 'block' }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format || 'auto'}
      data-full-width-responsive={responsive ? 'true' : 'false'}
    />
  )
}
