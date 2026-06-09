'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import jsPDF from 'jspdf'
import mammoth from 'mammoth'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const STORAGE_NOTES = 'notepad_notes'
const STORAGE_ACTIVE = 'notepad_active_id'
const STORAGE_THEME = 'notepad_theme'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function formatDate(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h}h ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_NOTES)
    if (raw) {
      const parsed = JSON.parse(raw) as Note[]
      // Coerce any missing/undefined content fields to empty string
      return parsed.map(n => ({ ...n, content: n.content ?? '' }))
    }
  } catch {}
  // Legacy migration
  const legacy = localStorage.getItem('main_notepad_html') || ''
  const first: Note = { id: genId(), title: 'Note 1', content: legacy, updatedAt: Date.now() }
  localStorage.setItem(STORAGE_NOTES, JSON.stringify([first]))
  return [first]
}

function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_NOTES, JSON.stringify(notes))
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Notepad() {
  // ── Core state ────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<Note[]>([])
  const [activeId, setActiveId] = useState('')
  const [content, setContent] = useState('')
  const [isDark, setIsDark] = useState(true)

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState('')

  // ── Find & Replace ────────────────────────────────────────────────────────
  const [showFind, setShowFind] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [findMatches, setFindMatches] = useState(0)
  const [findIdx, setFindIdx] = useState(0)

  // ── Save modal ────────────────────────────────────────────────────────────
  const [showSave, setShowSave] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // ── Misc ──────────────────────────────────────────────────────────────────
  const [importedFile, setImportedFile] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  // ── Refs ──────────────────────────────────────────────────────────────────
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<Note[]>([])
  const activeIdRef = useRef('')
  const contentRef = useRef('')
  const saveTimer = useRef<NodeJS.Timeout | null>(null)

  // Keep refs in sync
  useEffect(() => { notesRef.current = notes }, [notes])
  useEffect(() => { activeIdRef.current = activeId }, [activeId])
  useEffect(() => { contentRef.current = content }, [content])

  // ── Persist ───────────────────────────────────────────────────────────────

  const persist = useCallback((text: string) => {
    const id = activeIdRef.current
    if (!id) return
    const updated = notesRef.current.map(n =>
      n.id === id ? { ...n, content: text, updatedAt: Date.now() } : n
    )
    notesRef.current = updated
    setNotes(updated)
    saveNotes(updated)
  }, [])

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const all = loadNotes()
    notesRef.current = all
    setNotes(all)
    const savedId = localStorage.getItem(STORAGE_ACTIVE) || all[0]?.id || ''
    const active = all.find(n => n.id === savedId) || all[0]
    setActiveId(active.id)
    activeIdRef.current = active.id
    localStorage.setItem(STORAGE_ACTIVE, active.id)
    setContent(active.content ?? '')
    contentRef.current = active.content ?? ''
    if (localStorage.getItem(STORAGE_THEME) === 'light') setIsDark(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Autosave every 5 s
  useEffect(() => {
    const t = setInterval(() => persist(contentRef.current), 5000)
    return () => clearInterval(t)
  }, [persist])

  useEffect(() => {
    const handler = () => persist(contentRef.current)
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [persist])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key === 's') { e.preventDefault(); setShowSave(true); setSaveMsg('') }
      if (mod && e.key === 'f') { e.preventDefault(); setShowFind(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  // ── Notes management ──────────────────────────────────────────────────────

  const switchNote = useCallback((id: string) => {
    if (id === activeIdRef.current) { setSidebarOpen(false); return }
    persist(contentRef.current)
    const target = notesRef.current.find(n => n.id === id)
    if (!target) return
    setActiveId(id)
    activeIdRef.current = id
    localStorage.setItem(STORAGE_ACTIVE, id)
    setContent(target.content ?? '')
    contentRef.current = target.content ?? ''
    setImportedFile('')
    clearFind()
    setSidebarOpen(false)
  }, [persist])

  const createNote = useCallback(() => {
    persist(contentRef.current)
    const note: Note = { id: genId(), title: `Note ${notesRef.current.length + 1}`, content: '', updatedAt: Date.now() }
    const updated = [note, ...notesRef.current]
    notesRef.current = updated
    setNotes(updated)
    saveNotes(updated)
    setActiveId(note.id)
    activeIdRef.current = note.id
    localStorage.setItem(STORAGE_ACTIVE, note.id)
    setContent('')
    contentRef.current = ''
    setImportedFile('')
    clearFind()
    setSidebarOpen(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [persist])

  const deleteNote = useCallback((id: string) => {
    if (notesRef.current.length <= 1) { alert('You must keep at least one note.'); return }
    if (!window.confirm('Delete this note? This cannot be undone.')) return
    const updated = notesRef.current.filter(n => n.id !== id)
    notesRef.current = updated
    setNotes(updated)
    saveNotes(updated)
    if (id === activeIdRef.current) {
      const next = updated[0]
      setActiveId(next.id)
      activeIdRef.current = next.id
      localStorage.setItem(STORAGE_ACTIVE, next.id)
      setContent(next.content ?? '')
      contentRef.current = next.content ?? ''
    }
  }, [])

  const renameNote = useCallback((id: string, val: string) => {
    const title = val.trim() || 'Untitled'
    const updated = notesRef.current.map(n => n.id === id ? { ...n, title, updatedAt: Date.now() } : n)
    notesRef.current = updated
    setNotes(updated)
    saveNotes(updated)
    setRenamingId(null)
  }, [])

  const activeNote = notes.find(n => n.id === activeId)

  // ── Find & Replace ────────────────────────────────────────────────────────

  function clearFind() {
    setFindText('')
    setReplaceText('')
    setFindMatches(0)
    setFindIdx(0)
  }

  function countMatches(term: string, text: string): number {
    if (!term) return 0
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    return (text.match(re) || []).length
  }

  function scrollToMatch(term: string, idx: number) {
    const ta = textareaRef.current
    if (!ta || !term) return
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    let c = 0, m: RegExpExecArray | null
    while ((m = re.exec(ta.value)) !== null) {
      if (c++ === idx) {
        ta.focus()
        ta.setSelectionRange(m.index, re.lastIndex)
        break
      }
    }
  }

  function doFind(term?: string, targetIdx?: number) {
    const t = term ?? findText
    if (!t) return
    const total = countMatches(t, content)
    setFindMatches(total)
    const idx = targetIdx ?? 0
    setFindIdx(idx)
    scrollToMatch(t, idx)
  }

  function findNext() {
    if (findMatches === 0) {
      // Run the search first, then jump to the first match
      if (!findText) return
      const total = countMatches(findText, content)
      setFindMatches(total)
      setFindIdx(0)
      scrollToMatch(findText, 0)
      return
    }
    const next = (findIdx + 1) % findMatches
    setFindIdx(next)
    scrollToMatch(findText, next)
  }

  function findPrev() {
    if (findMatches === 0) {
      // Run the search first, then jump to the last match
      if (!findText) return
      const total = countMatches(findText, content)
      setFindMatches(total)
      const last = Math.max(0, total - 1)
      setFindIdx(last)
      scrollToMatch(findText, last)
      return
    }
    const prev = (findIdx - 1 + findMatches) % findMatches
    setFindIdx(prev)
    scrollToMatch(findText, prev)
  }

  function doReplaceAll() {
    if (!findText) return
    const re = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const next = content.replace(re, replaceText)
    setContent(next)
    persist(next)
    setFindMatches(0)
    setFindIdx(0)
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function exportTXT() {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeNote?.title || 'note'}_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportMD() {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeNote?.title || 'note'}_${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPDF() {
    if (!content.trim()) { alert('Note is empty.'); return }
    const pdf = new jsPDF()
    const margin = 20
    const maxW = pdf.internal.pageSize.getWidth() - 2 * margin
    const lineH = 7
    const lines: string[] = []
    content.split('\n').forEach(line => {
      if (!line) { lines.push(''); return }
      let cur = ''
      line.split(' ').forEach(word => {
        const test = cur + (cur ? ' ' : '') + word
        if (pdf.getTextWidth(test) > maxW && cur) { lines.push(cur); cur = word }
        else cur = test
      })
      if (cur) lines.push(cur)
    })
    let y = margin
    lines.forEach(l => {
      if (y + lineH > pdf.internal.pageSize.getHeight() - margin) { pdf.addPage(); y = margin }
      pdf.text(l, margin, y); y += lineH
    })
    pdf.save(`${activeNote?.title || 'note'}_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  function saveToHistory() {
    persist(content)
    setSaveMsg('✓ Saved')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async function processFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    try {
      let text = ''
      if (ext === 'docx') {
        const buf = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer: buf })
        text = result.value
      } else {
        text = await new Promise<string>((res, rej) => {
          const r = new FileReader()
          r.onload = () => res(typeof r.result === 'string' ? r.result : '')
          r.onerror = () => rej(new Error('Read failed'))
          r.readAsText(file, 'UTF-8')
        })
      }
      const next = content + (content ? '\n' : '') + text
      setContent(next)
      persist(next)
      setImportedFile(file.name)
      alert('File imported successfully.')
    } catch {
      alert('Failed to import file.')
    }
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragOver(true) }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); setIsDragOver(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (['txt', 'json', 'dat', 'docx', 'md'].includes(ext || '')) processFile(file)
    else alert('Unsupported file type. Use TXT, MD, JSON, DAT, or DOCX.')
  }

  // ── Theme ─────────────────────────────────────────────────────────────────

  function toggleTheme() {
    setIsDark(v => {
      localStorage.setItem(STORAGE_THEME, v ? 'light' : 'dark')
      return !v
    })
  }

  // ── Textarea handlers ─────────────────────────────────────────────────────

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setContent(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persist(val), 800)
    // Clear find highlights when content changes
    if (findMatches > 0) { setFindMatches(0); setFindIdx(0) }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart, end = ta.selectionEnd
      const next = content.substring(0, start) + '    ' + content.substring(end)
      setContent(next)
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 4 })
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowFind(true) }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); setShowSave(true); setSaveMsg('') }
  }

  // ── Counts ────────────────────────────────────────────────────────────────

  const safeContent = content ?? ''
  const wordCount = safeContent.trim() ? safeContent.trim().split(/\s+/).length : 0
  const charCount = safeContent.length

  // ── Render ────────────────────────────────────────────────────────────────

  const theme = isDark ? 'dark' : 'light'

  return (
    <div className={`np ${theme}${isDragOver ? ' dragover' : ''}`}>

      {/* ── Sidebar backdrop ── */}
      {sidebarOpen && <div className="sb-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <div className="sidebar" onClick={e => e.stopPropagation()}>
          <div className="sb-head">
            <span className="sb-title">My Notes</span>
            <button className="sb-new" onClick={createNote}>＋ New</button>
          </div>
          <div className="sb-list">
            {notes.map(note => (
              <div
                key={note.id}
                className={`sb-item${note.id === activeId ? ' sb-active' : ''}`}
                onClick={() => switchNote(note.id)}
              >
                <div className="sb-body">
                  {renamingId === note.id ? (
                    <input
                      className="sb-rename"
                      autoFocus
                      value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onBlur={() => renameNote(note.id, renameVal)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameNote(note.id, renameVal)
                        if (e.key === 'Escape') setRenamingId(null)
                        e.stopPropagation()
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="sb-name"
                      onDoubleClick={e => { e.stopPropagation(); setRenamingId(note.id); setRenameVal(note.title) }}
                      title="Double-click to rename"
                    >{note.title}</span>
                  )}
                  <span className="sb-date">{formatDate(note.updatedAt)}</span>
                  <span className="sb-preview">{note.content.slice(0, 60) || '(empty)'}</span>
                </div>
                <button className="sb-del" title="Delete" onClick={e => { e.stopPropagation(); deleteNote(note.id) }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="header">
        <div className="header-left">
          <button
            className={`sb-toggle${sidebarOpen ? ' sb-toggle-on' : ''}`}
            onClick={() => setSidebarOpen(v => !v)}
            title="Notes"
          >
            ☰ Notes <span className="badge">{notes.length}</span>
          </button>

          {editingTitle ? (
            <input
              className="title-input"
              autoFocus
              value={titleVal}
              onChange={e => setTitleVal(e.target.value)}
              onBlur={() => { renameNote(activeId, titleVal); setEditingTitle(false) }}
              onKeyDown={e => {
                if (e.key === 'Enter') { renameNote(activeId, titleVal); setEditingTitle(false) }
                if (e.key === 'Escape') setEditingTitle(false)
              }}
            />
          ) : (
            <h3
              className="title-display"
              onDoubleClick={() => { setTitleVal(activeNote?.title || ''); setEditingTitle(true) }}
              title="Double-click to rename"
            >
              {activeNote?.title || 'Notes'}
              {importedFile && <span className="imported"> ({importedFile})</span>}
            </h3>
          )}
        </div>

        <div className="controls">
          <button onClick={createNote} title="New note">＋ New</button>
          <button onClick={toggleTheme}>{isDark ? '☀ Light' : '🌙 Dark'}</button>
          <button onClick={() => fileInputRef.current?.click()}>Import</button>
          <button onClick={() => { setShowSave(true); setSaveMsg('') }} title="Save / Export (Ctrl+S)">💾 Save</button>
          <button onClick={() => setShowFind(v => !v)} title="Find & Replace (Ctrl+F)">🔍 Find</button>
          <button onClick={() => (window.location.href = '/')}>Home</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.json,.dat,.docx"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '' }}
          />
        </div>
      </div>

      {/* ── Find bar ── */}
      {showFind && (
        <div className="find-bar">
          <input
            className="find-input"
            placeholder="Find…"
            value={findText}
            autoFocus
            onChange={e => {
              setFindText(e.target.value)
              setFindMatches(0)
              setFindIdx(0)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.shiftKey ? findPrev() : doFind(findText) }
              if (e.key === 'Escape') { setShowFind(false); clearFind() }
            }}
          />
          <button onClick={() => doFind(findText)}>Find</button>
          <button onClick={findPrev} disabled={findMatches === 0} title="Previous (Shift+Enter)">◀</button>
          <button onClick={findNext} disabled={findMatches === 0} title="Next (Enter)">▶</button>
          {findMatches > 0 && <span className="find-count">{findIdx + 1}/{findMatches}</span>}
          <div className="find-sep" />
          <input
            className="find-input"
            placeholder="Replace with…"
            value={replaceText}
            onChange={e => setReplaceText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doReplaceAll() }}
          />
          <button onClick={doReplaceAll}>Replace All</button>
          <button onClick={() => { setShowFind(false); clearFind() }} style={{ marginLeft: 'auto' }}>✕</button>
        </div>
      )}

      {/* ── Textarea ── */}
      <textarea
        ref={textareaRef}
        className="editor"
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        placeholder="Start typing… (drag & drop TXT, MD, DOCX to import)"
        dir="ltr"
        spellCheck
      />

      {/* ── Status bar ── */}
      <div className="status">
        <span>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
        <span>{charCount} char{charCount !== 1 ? 's' : ''}</span>
        <span style={{ marginLeft: 'auto', opacity: 0.5 }}>Plain text</span>
      </div>

      {/* ── Save / Export modal ── */}
      {showSave && (
        <div className="modal-backdrop" onClick={() => setShowSave(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span>Save / Export</span>
              <button className="modal-close" onClick={() => setShowSave(false)}>✕</button>
            </div>
            <div className="modal-body">
              <button className="modal-btn primary" onClick={saveToHistory}>
                <span className="modal-icon">📌</span>
                <div>
                  <div className="modal-btn-title">Save to History</div>
                  <div className="modal-btn-sub">Keeps this version in the notes sidebar</div>
                </div>
              </button>
              <button className="modal-btn" onClick={() => { exportMD(); setShowSave(false) }}>
                <span className="modal-icon">📝</span>
                <div>
                  <div className="modal-btn-title">Export as Markdown (.md)</div>
                  <div className="modal-btn-sub">Plain text with formatting markers</div>
                </div>
              </button>
              <button className="modal-btn" onClick={() => { exportPDF(); setShowSave(false) }}>
                <span className="modal-icon">📄</span>
                <div>
                  <div className="modal-btn-title">Export as PDF</div>
                  <div className="modal-btn-sub">Printable document</div>
                </div>
              </button>
              <button className="modal-btn" onClick={() => { exportTXT(); setShowSave(false) }}>
                <span className="modal-icon">🗒</span>
                <div>
                  <div className="modal-btn-title">Export as Plain Text (.txt)</div>
                  <div className="modal-btn-sub">No formatting, universal compatibility</div>
                </div>
              </button>
              {saveMsg && <div className="modal-status">{saveMsg}</div>}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ── Root ── */
        .np {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          position: relative;
          font-family: sans-serif;
          transition: background-color 0.3s, color 0.3s;
        }
        .np.dragover::before {
          content: 'Drop file here';
          position: absolute;
          inset: 0;
          background: rgba(0, 123, 255, 0.1);
          border: 3px dashed #007bff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          color: #007bff;
          z-index: 2000;
          pointer-events: none;
        }
        .dark { background: #222; color: #eee; }
        .light { background: #f0f0f0; color: #333; }

        /* ── Header ── */
        .header {
          padding: 8px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
          gap: 10px;
          flex-wrap: wrap;
        }
        .dark .header { background: #111; }
        .light .header { background: #333; color: #fff; }
        .header-left { display: flex; align-items: center; gap: 8px; min-width: 0; flex-shrink: 1; }
        .controls { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }
        .imported { font-size: 11px; opacity: 0.65; }

        /* ── Title ── */
        .title-display {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          cursor: default;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }
        .title-input {
          font-size: 15px;
          font-weight: 600;
          background: transparent;
          border: none;
          border-bottom: 2px solid #4a90e2;
          outline: none;
          color: inherit;
          max-width: 180px;
          padding: 0 2px;
        }

        /* ── Sidebar toggle ── */
        .sb-toggle {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          border: none;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .dark .sb-toggle { background: #2a2a2a; color: #ccc; }
        .light .sb-toggle { background: #555; color: #fff; }
        .sb-toggle-on { background: #4a90e2 !important; color: #fff !important; }
        .badge {
          background: #4a90e2;
          color: #fff;
          border-radius: 999px;
          font-size: 10px;
          padding: 1px 6px;
          font-weight: 700;
        }
        .sb-toggle-on .badge { background: rgba(255,255,255,0.3); }

        /* ── Sidebar ── */
        .sb-backdrop { position: fixed; inset: 0; z-index: 999; }
        .sidebar {
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: 280px;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          box-shadow: 4px 0 24px rgba(0,0,0,0.4);
        }
        .dark .sidebar { background: #161616; border-right: 1px solid #333; color: #eee; }
        .light .sidebar { background: #fafafa; border-right: 1px solid #ccc; color: #222; }
        .sb-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 14px 10px;
          border-bottom: 1px solid rgba(128,128,128,0.2);
          flex-shrink: 0;
        }
        .sb-title { font-size: 14px; font-weight: 700; }
        .sb-new {
          padding: 5px 12px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          background: #4a90e2;
          color: #fff;
        }
        .sb-new:hover { background: #357ab8; }
        .sb-list { flex: 1; overflow-y: auto; padding: 6px 0; }
        .sb-item {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          padding: 10px 12px;
          cursor: pointer;
          border-left: 3px solid transparent;
          transition: background 0.15s;
        }
        .dark .sb-item:hover { background: #222; }
        .light .sb-item:hover { background: #eee; }
        .sb-active { border-left-color: #4a90e2 !important; }
        .dark .sb-active { background: #1e2a3a !important; }
        .light .sb-active { background: #ddeeff !important; }
        .sb-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .sb-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb-date { font-size: 10px; opacity: 0.5; }
        .sb-preview { font-size: 11px; opacity: 0.55; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
        .sb-rename {
          font-size: 13px;
          font-weight: 600;
          background: transparent;
          border: none;
          border-bottom: 1px solid #4a90e2;
          outline: none;
          color: inherit;
          width: 100%;
          padding: 0;
        }
        .sb-del {
          flex-shrink: 0;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          opacity: 0.3;
          padding: 2px 4px;
          border-radius: 4px;
          color: inherit;
          transition: opacity 0.15s;
        }
        .sb-del:hover { opacity: 1; background: rgba(220,50,50,0.15); color: #e55; }

        /* ── Buttons ── */
        button {
          border: none;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.1s;
          font-size: 13px;
        }
        .dark button { background: #444; color: #eee; }
        .dark button:hover { background: #666; transform: scale(1.03); }
        .light button { background: #555; color: #fff; }
        .light button:hover { background: #777; transform: scale(1.03); }
        button:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }

        /* ── Find bar ── */
        .find-bar {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 14px;
          flex-shrink: 0;
          border-bottom: 1px solid rgba(128,128,128,0.25);
          flex-wrap: wrap;
        }
        .dark .find-bar { background: #1a1a1a; }
        .light .find-bar { background: #e8e8e8; }
        .find-input {
          padding: 5px 10px;
          border-radius: 6px;
          border: 1px solid rgba(128,128,128,0.4);
          font-size: 13px;
          outline: none;
          min-width: 150px;
        }
        .dark .find-input { background: #333; color: #eee; border-color: #555; }
        .light .find-input { background: #fff; color: #333; }
        .find-count { font-size: 12px; opacity: 0.85; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .find-sep { width: 1px; height: 20px; background: rgba(128,128,128,0.35); flex-shrink: 0; }

        /* ── Textarea ── */
        .editor {
          flex: 1;
          width: 100%;
          padding: 20px;
          font-size: 16px;
          box-sizing: border-box;
          border: none;
          outline: none;
          overflow: auto;
          direction: ltr;
          white-space: pre-wrap;
          word-break: break-word;
          font-family: inherit;
          resize: none;
          line-height: 1.6;
        }
        .dark .editor { background: #333; color: #eee; }
        .light .editor { background: #fff; color: #333; }

        /* ── Status bar ── */
        .status {
          display: flex;
          gap: 16px;
          padding: 4px 20px;
          font-size: 11px;
          opacity: 0.6;
          flex-shrink: 0;
          border-top: 1px solid rgba(128,128,128,0.2);
        }
        .dark .status { background: #1a1a1a; }
        .light .status { background: #e8e8e8; }

        /* ── Modal ── */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(3px);
          z-index: 3000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .modal {
          width: 100%;
          max-width: 420px;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .dark .modal { background: #1a1a1a; border: 1px solid #333; color: #eee; }
        .light .modal { background: #fff; border: 1px solid #ccc; color: #222; }
        .modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          font-size: 15px;
          font-weight: 700;
          border-bottom: 1px solid rgba(128,128,128,0.2);
        }
        .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; opacity: 0.5; padding: 0 4px; }
        .modal-close:hover { opacity: 1; transform: none; }
        .modal-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .modal-btn {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: background 0.15s;
        }
        .dark .modal-btn { background: #252525; color: #eee; }
        .dark .modal-btn:hover { background: #333; transform: none; }
        .light .modal-btn { background: #f5f5f5; color: #222; }
        .light .modal-btn:hover { background: #e8e8e8; transform: none; }
        .modal-btn.primary { border: 2px solid #4a90e2; }
        .modal-icon { font-size: 22px; flex-shrink: 0; }
        .modal-btn-title { font-size: 14px; font-weight: 600; }
        .modal-btn-sub { font-size: 11px; opacity: 0.55; margin-top: 2px; }
        .modal-status { text-align: center; font-size: 13px; color: #4ade80; padding: 4px 0; }

        @media (max-width: 768px) {
          .header { flex-direction: column; gap: 8px; align-items: stretch; }
          .controls { flex-wrap: wrap; justify-content: center; }
          button { flex-grow: 1; text-align: center; }
          .sidebar { width: 100%; }
        }
      `}</style>
    </div>
  )
}
