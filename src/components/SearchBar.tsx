'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface LessonItem {
  id?: string
  title: string
  type?: string
}

interface SubjectItem {
  id?: string
  title: string
  lessons?: LessonItem[]
}

interface SemesterItem {
  id: string
  title: string
  subjects: SubjectItem[]
}

interface Suggestion {
  kind: 'lesson' | 'subject' | 'tool' | 'game'
  label: string
  semesterId?: string
  semesterTitle?: string
  subjectId?: string
  subjectTitle?: string
  lessonIdOrTitle?: string
  url?: string
}

const STATIC_TOOLS = [
  { kind: 'tool', label: 'Notepad', url: '/notepad' },
  { kind: 'tool', label: 'Drawpad', url: '/drawpad' },
  { kind: 'tool', label: 'UML Maker (Schema Drawer)', url: '/games/schema-drawer' },
  { kind: 'tool', label: 'Flashcards', url: '/games/flashcards' },
  { kind: 'game', label: 'Games and Extras', url: '/games' },
  { kind: 'game', label: 'Octashot', url: '/games/octashot' },
  { kind: 'game', label: 'Snake', url: '/games/snake' },
  { kind: 'game', label: 'Music Destroyer', url: '/games/music-destroyer' },
  { kind: 'tool', label: 'Extra Documents and Books', url: 'https://drive.google.com/drive/folders/11WJHRKmG4jKrcgWr_OTflGSMI2ZqX7II?usp=drive_link' },
  { kind: 'tool', label: 'OCR Service for PDFs', url: 'https://www.ilovepdf.com/ocr-pdf' },
  { kind: 'tool', label: 'TeX - LaTeX reader and PDF exporter', url: 'https://texviewer.herokuapp.com/' },
  { kind: 'tool', label: 'Claude - AI for Academics', url: 'https://claude.ai/new/' },
] as const;

export default function SearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [cache, setCache] = useState<SemesterItem[]>([])

  // Load and cache semesters.json via API
  useEffect(() => {
    let mounted = true
    const cached = sessionStorage.getItem('semesters_cache')
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        const arr: SemesterItem[] = Array.isArray(parsed) ? parsed : (parsed?.semesters ?? [])
        setCache(arr)
      } catch {}
    }
    if (!cached) {
      fetch('/api/semesters')
        .then((r) => r.json())
        .then((data) => {
          if (!mounted) return
          const arr: SemesterItem[] = Array.isArray(data) ? data : (data?.semesters ?? [])
          setCache(arr)
          sessionStorage.setItem('semesters_cache', JSON.stringify(arr))
        })
        .catch(() => {})
    }
    return () => {
      mounted = false
    }
  }, [])

  // Close dropdown on outside click or Esc
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      // Only handle keyboard shortcuts when focus is within the search bar
      const target = e.target as HTMLElement | null
      const activeEl = document.activeElement as HTMLElement | null
      const isWithinSearch = !!containerRef.current && (
        (target && containerRef.current.contains(target)) ||
        (activeEl && containerRef.current.contains(activeEl))
      )
      if (!isWithinSearch) return

      if (e.key === 'Escape') {
        setOpen(false)
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          selectSuggestion(suggestions[activeIndex])
        } else if (suggestions.length > 0) {
          // default to first if none active
          selectSuggestion(suggestions[0])
        }
      }
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [suggestions, activeIndex])

  // Debounced search
  useEffect(() => {
    const handle = setTimeout(() => {
      if (!query.trim()) {
        setSuggestions([])
        setActiveIndex(-1)
        setOpen(false)
        return
      }
      const q = query.trim().toLowerCase()
      const out: Suggestion[] = []
      for (const sem of cache) {
        for (const subj of sem.subjects || []) {
          // subject match
          if (subj.title && subj.title.toLowerCase().includes(q)) {
            out.push({
              kind: 'subject',
              label: subj.title,
              semesterId: sem.id,
              semesterTitle: sem.title,
              subjectId: subj.id ?? subj.title,
              subjectTitle: subj.title,
            })
          }
          for (const les of subj.lessons || []) {
            const name = les.title || ''
            if (name.toLowerCase().includes(q)) {
              out.push({
                kind: 'lesson',
                label: name,
                semesterId: sem.id,
                semesterTitle: sem.title,
                subjectId: subj.id ?? subj.title,
                subjectTitle: subj.title,
                lessonIdOrTitle: les.id ?? les.title,
              })
            }
          }
        }
      }
      
      for (const item of STATIC_TOOLS) {
        if (item.label.toLowerCase().includes(q)) {
          out.push({
            kind: item.kind,
            label: item.label,
            url: item.url,
          })
        }
      }
      // Limit and sort basic relevance (shorter to longer labels)
      const limited = out
        .sort((a, b) => a.label.length - b.label.length)
        .slice(0, 10)
      setSuggestions(limited)
      setActiveIndex(limited.length ? 0 : -1)
      setOpen(true)
    }, 300)
    return () => clearTimeout(handle)
  }, [query, cache])

  const selectSuggestion = (s: Suggestion) => {
    setOpen(false)
    setSuggestions([])
    setActiveIndex(-1)
    setQuery('')
    
    if (s.kind === 'tool' || s.kind === 'game') {
      if (s.url?.startsWith('http')) {
        window.open(s.url, '_blank')
      } else if (s.url) {
        router.push(s.url)
      }
      return
    }

    const hash = s.kind === 'lesson'
      ? `lesson-${s.lessonIdOrTitle}`
      : `subject-${s.subjectId}`
    router.push(`/semester/${s.semesterId}#${encodeURIComponent(hash)}`)
  }

  const pill = (text: string, tone: 'blue' | 'gray' | 'green') => {
    const tones: Record<typeof tone, string> = {
      blue: 'bg-white/80 text-blue-700',
      gray: 'bg-white/70 text-gray-700',
      green: 'bg-white/80 text-green-700',
    }
    return (
      <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs shadow-sm ${tones[tone]}`}>
        {text}
      </span>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Simple visible input */}
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search lessons and subjects..."
        className="w-full rounded-md px-4 py-2 bg-[#1e1e1e] text-white placeholder:text-gray-400 outline-none ring-1 ring-[#333] focus:ring-2 focus:ring-blue-500"
        onFocus={() => setOpen(Boolean(query.trim()))}
      />

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 mt-2 w-full rounded-md bg-[#1e1e1e] shadow-md ring-1 ring-[#333] p-2 z-50">
          <ul className="space-y-1">
            {suggestions.map((s, i) => (
              <li key={`${s.kind}-${s.semesterId || s.url}-${s.subjectId || ''}-${s.lessonIdOrTitle || ''}-${i}`}>
                <button
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex((idx) => (idx === i ? -1 : idx))}
                  onClick={() => selectSuggestion(s)}
                  className={`w-full rounded px-3 py-2 text-left transition-colors ${
                    activeIndex === i ? 'bg-[#2a2a2a]' : 'hover:bg-[#2a2a2a]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-white">{s.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.semesterTitle && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-[#2a2a2a] text-blue-400">
                          {s.semesterTitle}
                        </span>
                      )}
                      {s.kind === 'lesson' && s.subjectTitle && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-[#2a2a2a] text-gray-300">
                          {s.subjectTitle}
                        </span>
                      )}
                      {(s.kind === 'tool' || s.kind === 'game') && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-[#2a2a2a] text-purple-400 capitalize">
                          {s.kind}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}