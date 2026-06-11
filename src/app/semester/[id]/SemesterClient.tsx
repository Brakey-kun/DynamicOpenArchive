'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import Adsense from '@/components/Adsense'
const SLOT_SEM_TOP = process.env.NEXT_PUBLIC_ADSENSE_SLOT_SEMESTER_TOP || ''
const SLOT_SEM_BOTTOM = process.env.NEXT_PUBLIC_ADSENSE_SLOT_SEMESTER_BOTTOM || ''

import { Document, Page } from 'react-pdf'
import { pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

import { SemesterData, Subject, Element, Folder, isFolder, isLesson, getSemesterArchiveLink } from '@/app/api/semesters/types'
import { PreviewerState, getFileType, createInitialPreviewerState, createPreviewerState, createClosedPreviewerState } from '@/app/api/previewer/utils'
import { NotepadState, createInitialNotepadState, calculateCenteredPosition as calculateNotepadPosition, generateNotepadHTML, saveNotepadContent } from '@/app/api/notepad/utils'
import SearchBar from '@/components/SearchBar'
import MiniDrawpad from '@/components/floating/MiniDrawpad'
import OCRTool from '@/components/floating/OCRTool'

export default function SemesterPage({ params }: { params: { id: string } }) {
  const [semesterData, setSemesterData] = useState<SemesterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [userSession, setUserSession] = useState<any>(null)
  const [flags, setFlags] = useState<{ admin_screen_access: number; normal_login: number }>({ admin_screen_access: 1, normal_login: 1 })
  const [resolvedSemesterId, setResolvedSemesterId] = useState<string>(params.id)
  
  // Add state for the file previewer
  const [previewer, setPreviewer] = useState<PreviewerState>(createInitialPreviewerState())
  
  // Add state for PDF viewer
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  
  // Initialize notepad with default position values
  const [notepad, setNotepad] = useState<NotepadState>(createInitialNotepadState())
  
  const [drawpad, setDrawpad] = useState<{ isOpen: boolean; position: { x: number; y: number }; size: { width: number; height: number } }>({
    isOpen: false,
    position: { x: 100, y: 100 },
    size: { width: 420, height: 280 }
  })
  
  // Initialize OCR tool state
  const [ocrTool, setOcrTool] = useState<{ isOpen: boolean; position: { x: number; y: number }; size: { width: number; height: number } }>({
    isOpen: false,
    position: { x: 150, y: 150 },
    size: { width: 500, height: 600 }
  })
  
  // Add mobile detection state and refs for floating panels
  const [isMobile, setIsMobile] = useState(false)
  const notepadRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ isDragging: boolean; startX: number; startY: number }>({
    isDragging: false,
    startX: 0,
    startY: 0
  })
  
  
  
  // Dynamically update browser tab title on viewer open/close
  useEffect(() => {
    const base = `${semesterData?.title ?? `S${params.id}`} Archive`;
    if (previewer.isOpen && previewer.fileName) {
      document.title = `${previewer.fileName} Archive`;
    } else {
      document.title = base;
    }
  }, [previewer.isOpen, previewer.fileName, semesterData?.title, params.id]);

  // Function to open the file previewer
  const openPreviewer = (fileUrl: string, fileName: string) => {
    setPreviewer(createPreviewerState(fileUrl, fileName));
  };
  
  // Function to close the previewer
  const closePreviewer = () => {
    setPreviewer(createClosedPreviewerState());
    
    // Also close the notepad when closing the previewer
    if (notepad.isOpen) {
      setNotepad(prev => ({
        ...prev,
        isOpen: false
      }));
    }
    // Also close the drawpad when closing the previewer
    if (drawpad.isOpen) {
      setDrawpad(prev => ({
        ...prev,
        isOpen: false
      }))
    }

    // Also close the OCR Tool when closing the previewer
    if (ocrTool.isOpen) {
      setOcrTool(prev => ({
        ...prev,
        isOpen: false
      }))
    }
  };
  
  // Function to toggle the notepad
  const toggleNotepad = useCallback(() => {
    setNotepad(prev => {
      if (!prev.isOpen) {
        // Position the notepad in the center of the screen
        const { x: centerX, y: centerY } = calculateNotepadPosition(
          window.innerWidth,
          window.innerHeight
        );
        
        return {
          ...prev,
          isOpen: true,
          position: {
            x: centerX,
            y: centerY
          }
        };
      }
      // Otherwise just toggle the isOpen state
      return {
        ...prev,
        isOpen: !prev.isOpen
      };
    });
  }, []);
  
  // Function to handle element clicks (lessons and folders)
  const handleElementClick = (element: Element) => {
    if (isFolder(element)) {
      // For folders, open the URL in a new tab
      window.open(element.url, '_blank', 'noopener,noreferrer');
    } else if (isLesson(element)) {
      // For lessons, open in the previewer (existing behavior)
      const fileUrl = element.link || element.url;
      if (fileUrl) {
        openPreviewer(fileUrl, element.title);
      }
    }
  };

  // Function to handle notepad content change
  const handleNotepadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotepad(prev => ({
      ...prev,
      content: e.target.value
    }));
  };
  
  // Function to save notepad content as a text file
  const handleSaveNotepadContent = () => {
    saveNotepadContent(notepad.content, previewer.fileName);
  };
  
  // Functions for draggable notepad
  const handleMouseDown = (e: React.MouseEvent) => {
    if (notepadRef.current) {
      dragRef.current = {
        isDragging: true,
        startX: e.clientX - notepad.position.x,
        startY: e.clientY - notepad.position.y
      };
    }
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (dragRef.current.isDragging && notepadRef.current) {
      const newX = e.clientX - dragRef.current.startX;
      const newY = e.clientY - dragRef.current.startY;
      
      setNotepad(prev => ({
        ...prev,
        position: {
          x: newX,
          y: newY
        }
      }));
    }
  };
  
  const handleMouseUp = () => {
    dragRef.current.isDragging = false;
  };
  
  // Add event listeners for drag functionality
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Clean up the notepad popup message handler on unmount
  useEffect(() => {
    return () => {
      if (notepadMessageHandlerRef.current) {
        window.removeEventListener('message', notepadMessageHandlerRef.current);
      }
    };
  }, []);

  // Ref to hold the active notepad popup message handler so it can be cleaned up
  const notepadMessageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  // Function to open notepad content in a new fullscreen window/tab with editable functionality
  const openNotepadFullscreen = useCallback(() => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      // Create a unique ID for this notepad instance
      const notepadId = `notepad_${Date.now()}`;
      
      // Generate HTML content for the notepad window
      const htmlContent = generateNotepadHTML(
        notepadId,
        previewer.fileName,
        notepad.content,
        window.location.origin
      );
      
      newWindow.document.write(htmlContent);
      newWindow.document.close();
      
      // Remove any previously registered message handler before adding a new one
      if (notepadMessageHandlerRef.current) {
        window.removeEventListener('message', notepadMessageHandlerRef.current);
      }

      // Set up event listener to receive content updates from the popup
      const messageHandler = (event: MessageEvent) => {
        if (event.data && event.data.type === 'notepad-content') {
          setNotepad(prev => ({
            ...prev,
            content: event.data.content
          }));
        }
      };
      
      notepadMessageHandlerRef.current = messageHandler;
      window.addEventListener('message', messageHandler);
    } else {
      alert('Failed to open new window. Please check your browser pop-up settings.');
    }
  }, [previewer.fileName, notepad.content]);
  


  // Effect to detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // Adjust breakpoint as needed
    };
    checkMobile(); // Initial check
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Function to toggle Mini Drawpad
  const toggleDrawpad = useCallback(() => {
    setDrawpad(prev => {
      if (!prev.isOpen) {
        const width = prev.size.width;
        const height = prev.size.height;
        const x = Math.max(0, window.innerWidth - width - 24);
        const y = Math.max(0, window.innerHeight - height - 24);
        return { ...prev, isOpen: true, position: { x, y } };
      }
      return { ...prev, isOpen: !prev.isOpen };
    });
  }, []);
  
  // Function to toggle OCR Tool
  const toggleOCRTool = useCallback(() => {
    setOcrTool(prev => {
      if (!prev.isOpen) {
        const width = prev.size.width;
        const height = prev.size.height;
        const x = Math.max(0, (window.innerWidth - width) / 2);
        const y = Math.max(0, (window.innerHeight - height) / 2);
        return { ...prev, isOpen: true, position: { x, y } };
      }
      return { ...prev, isOpen: !prev.isOpen };
    });
  }, []);
  
  // Effect to handle "Alt+N" for toggling notepad
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault(); // Prevent any default browser action
        // Open fullscreen notepad instead of toggling the small one
        openNotepadFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openNotepadFullscreen]); // Depends on the memoized openNotepadFullscreen function

  // Function to handle text copying from iframe content
  // IFRAME TEXT COPYING FIX: Due to browser security restrictions, text cannot be directly
  // copied from cross-origin iframes (Google Drive, Docs, Slides). This function provides
  // alternative solutions by copying the document URL and guiding users to better options.
  const copyTextFromDocument = useCallback(async () => {
    try {
      // For Google Drive files, attempt to extract file ID and provide alternative access
      const fileId = extractGoogleDriveFileId(previewer.fileUrl);
      
      if (fileId) {
        // Create a message to inform user about copying limitations
        const message = `If text cannot be copied or doc previewer doesn't work:

1. If the document previewer doesn't work, click on "Download" to download it locally, or "Open in Gdrive" to open it directly on Google Drive

2. Use the OCR tool to extract text from images or scanned documents - click the OCR button in the toolbar 

3. Use the "Download" button to download the file and open it locally

4. Click "Open in Gdrive" to open the document in a new tab where you can copy text normally`;

        // Copy the Google Drive URL to clipboard as a fallback
        await navigator.clipboard.writeText(previewer.fileUrl);
        alert(message);
      } else {
        // For non-Google Drive files, show similar message
        const message = `If text cannot be copied or doc previewer doesn't work:

1. If the document previewer doesn't work, click on "Download" to download it locally, or "Open in Gdrive" to open it directly on Google Drive

2. Use the OCR tool to extract text from images or scanned documents - click the OCR button in the toolbar 

3. Use the "Download" button to download the file and open it locally

4. Click "Open in Gdrive" to open the document in a new tab where you can copy text normally`;
        
        await navigator.clipboard.writeText(previewer.fileUrl);
        alert(message);
      }
    } catch (error) {
      console.error('Error copying text:', error);
      alert('Unable to copy text. Please try downloading the file or opening it in a new tab.');
    }
  }, [previewer.fileUrl]);

  // Function to open the current file in Google Drive
  const openInGoogleDrive = () => {
    if (previewer.fileUrl) {
      // This function is called by a button that's only visible for GDrive links,
      // but a general check is still good.
      window.open(previewer.fileUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert('No file URL available to open.');
    }
  };


  
  // Function to handle PDF document loading
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };
  
  // Functions to navigate PDF pages
  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => Math.min(Math.max(prevPageNumber + offset, 1), numPages || 1));
  };
  
  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  useEffect(() => {
    // Check for user session from localStorage
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
        .catch(() => {});
    } catch {}

    // Backward compatibility: normalize legacy '7'/'s7' and '8'/'s8' to default specialization
    const normalizeId = (id: string): string => {
      const lower = id.toLowerCase();
      if (lower === '7' || lower === 's7') return 's7_bigdata_ai';
      if (lower === '8' || lower === 's8') return 's8_bigdata_ai';
      return id;
    };
    const normalizedId = normalizeId(params.id);
    setResolvedSemesterId(normalizedId);

    const fetchData = async (id: string) => {
      try {
        const response = await fetch(`/api/semesters/${id}`);
        if (response.ok) {
          const data = await response.json();
          setSemesterData(data);
          setLoading(false);
          // Cache under normalized key for offline access
          localStorage.setItem(`semester_${id}`, JSON.stringify(data));
          return;
        }
      } catch (error) {
        console.error('Failed to fetch semester data:', error);
      }

      // If API fails, try to get data from localStorage as fallback
      const storedData = localStorage.getItem(`semester_${id}`);
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          setSemesterData(parsedData);
          setLoading(false);
          return;
        } catch (error) {
          console.error("Error parsing localStorage data:", error);
        }
      }

      // Final fallback: minimal structure
      setSemesterData({ id, title: id.startsWith('s7_') || id.startsWith('s8_') ? id.replace('s7_', 'S7 - ').replace('s8_', 'S8 - ').replace('_', ' ').replace('bigdata ai', 'Big Data & AI') : `S${id}`, subjects: [] });
      setLoading(false);
    };

    // If normalized differs, redirect to normalized URL for consistency
    if (normalizedId !== params.id) {
      // Update URL without full reload
      window.history.replaceState({}, '', `/DynamicOpenArchive/semester/${normalizedId}/${window.location.hash || ''}`);
    }

    fetchData(normalizedId);
  }, [params.id]);

  // Hash navigation effect: scroll to target and open lessons by hash
  useEffect(() => {
    if (!semesterData) return;

    const processHash = () => {
      const hash = window.location.hash;
      if (!hash) return;
      const targetId = decodeURIComponent(hash.replace('#', ''));

      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.classList.add('highlight-pulse');
          setTimeout(() => el.classList.remove('highlight-pulse'), 1000);
        }

        if (targetId.startsWith('lesson-')) {
          const lessonKey = targetId.substring('lesson-'.length);
          const allElements = (semesterData?.subjects || []).flatMap((s: Subject) => s.lessons || []);
          const lesson = allElements.find((e: Element) => (e.id === lessonKey) || (!e.id && (e.title === lessonKey)));
          if (lesson && isLesson(lesson)) {
            handleElementClick(lesson);
          }
        }
      }, 0);
    };

    processHash();
    window.addEventListener('hashchange', processHash);
    return () => window.removeEventListener('hashchange', processHash);
  }, [semesterData]);

  if (loading) {
    return (
      <>
        <Head>
          <title>{`S${params.id} | Faculty Archive`}</title>
        </Head>
        <div>Loading...</div>
      </>
    )
  }

  if (!semesterData) {
    return (
      <>
        <Head>
          <title>{`Faculty Archive`}</title>
        </Head>
        <div>Semester not found</div>
      </>
    )
  }

  // Extract Google Drive file ID from URL for preview
  const extractGoogleDriveFileId = (url: string): string | null => {
    // Match patterns like /d/FILE_ID/ or id=FILE_ID
    const match = url.match(/\/d\/([^\/]+)\/|id=([^&]+)/);
    return match ? (match[1] || match[2]) : null;
  };
  
  // Get Google Drive preview URL
  const getGoogleDrivePreviewUrl = (url: string): string => {
    const fileId = extractGoogleDriveFileId(url);
    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    return url;
  };

  // Add a function to handle file downloads
  const downloadFile = async (url: string, fileName: string) => {
    try {
      // For Google Drive files, we need to use a different approach
      const fileId = extractGoogleDriveFileId(url);
      if (fileId) {
        // Google Drive direct download URL
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        window.open(downloadUrl, '_blank');
        return;
      }

      // For regular URLs
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Create a temporary anchor element
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = fileName;
      
      // Append to the document, click it, and remove it
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (error) {
      console.error('Error downloading file:', error);
      // Fallback to opening in a new tab if download fails
      window.open(url, '_blank');
    }
  };

  return (
    <>
      <Head>
        <title>{`${previewer.isOpen && previewer.fileName ? `${previewer.fileName} | Faculty Archive` : `${semesterData?.title ?? `S${params.id}`} | Faculty Archive`}`}</title>
      </Head>
      <div className="main-container" style={{ backgroundColor: '#000000', color: 'white', minHeight: '100vh' }}>
      <header className="semester-header">
        <Link href="/" className="site-title">
          <h1>Dynamic Open Archive</h1>
        </Link>
      </header>
      
      <div className="search-section">
        <SearchBar />
      </div>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 12 }}>
        <div style={{ maxWidth: 1000, width: '100%', padding: '0 16px' }}>
          <Adsense slot={SLOT_SEM_TOP} responsive style={{ display: 'block', minHeight: 60 }} format="horizontal" />
        </div>
      </div>
      {/* File Previewer Modal */}
      {previewer.isOpen && (
        <div className="previewer-overlay">
          <div className="previewer-container">
            <div className="previewer-header">
              <h3>{previewer.fileName}</h3>
              <div className="previewer-controls">
                {!isMobile && (
                  <>
                    <button 
                      onClick={toggleNotepad}
                      className="notepad-button"
                    >
                      Notepad (Alt+N for Fullscreen)
                    </button>

                    {/* Mini Drawpad Button */}
                    <button
                      onClick={toggleDrawpad}
                      className="drawpad-button"
                    >
                      Drawpad
                    </button>
                    {/* OCR Tool Button */}
                    <button
                      onClick={toggleOCRTool}
                      className="ocr-button"
                    >
                      Text Extraction (OCR)
                    </button>
                  </>
                )}
                {/* IFRAME TEXT COPYING SOLUTION: Copy Text Button - Available for all iframe content */}
                {/* Provides alternative text copying solutions when direct iframe text selection is blocked */}
                {previewer.fileType !== 'pdf' && previewer.fileType !== 'image' && (
                  <button
                    onClick={copyTextFromDocument}
                    className="copy-text-button"
                    title="Copy document text (with alternatives for restricted content)"
                  >
                    Copy or Doc issue?
                  </button>
                )}
                {/* "Open from Source" Button */}
                <button
                  onClick={openInGoogleDrive}
                  className="gdrive-button" 
                >
                  Open from Source
                </button>
              <button 
                onClick={() => downloadFile(previewer.fileUrl, previewer.fileName)}
                className="download-button"
              >
                Download
              </button>
              <button onClick={closePreviewer} className="close-button">
                Close
              </button>
              </div>
            </div>
            
            <div className="previewer-content">
              {previewer.fileType === 'pdf' ? (
                <div className="pdf-container">
                  <Document
                    file={previewer.fileUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    options={{ cMapUrl: 'cmaps/', cMapPacked: true }}
                  >
                    <Page 
                      pageNumber={pageNumber} 
                      width={Math.min(window.innerWidth * 0.95, 1200)}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                    />
                  </Document>
                  
                  {numPages && (
                    <div className="pdf-navigation">
                      <button 
                        onClick={previousPage} 
                        disabled={pageNumber <= 1}
                        className="pdf-nav-button"
                      >
                        Previous
                      </button>
                      <p>
                        Page {pageNumber} of {numPages}
                      </p>
                      <button 
                        onClick={nextPage} 
                        disabled={pageNumber >= (numPages || 1)}
                        className="pdf-nav-button"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              ) : previewer.fileType === 'image' ? (
                <img 
                  src={previewer.fileUrl} 
                  alt={previewer.fileName} 
                  style={{ maxWidth: '100%', maxHeight: '80vh' }} 
                />
              ) : (
                <iframe 
                  src={getGoogleDrivePreviewUrl(previewer.fileUrl)}
                  width="100%" 
                  height="100%" 
                  frameBorder="0" 
                  allowFullScreen
                  title={previewer.fileName}
                  className="previewer-iframe" /* Ensure consistent styling via globals */
                ></iframe>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Notepad Component */}
      {notepad.isOpen && (
        <div 
          className="notepad-container"
          ref={notepadRef}
          style={{
            left: `${notepad.position.x}px`,
            top: `${notepad.position.y}px`
          }}
        >
          <div 
            className="notepad-header"
            onMouseDown={handleMouseDown}
          >
            <h4>Notes for {previewer.fileName}</h4>
            <div className="notepad-controls">
              {/* Fullscreen Notepad Button */}
              <button
                onClick={openNotepadFullscreen}
                className="fullscreen-button"
              >
                Fullscreen
              </button>
              <button 
                onClick={handleSaveNotepadContent}
                className="save-button"
              >
                Save as TXT
              </button>
              <button 
                onClick={toggleNotepad}
                className="close-button"
              >
                Close
              </button>
            </div>
          </div>
          <textarea
            className="notepad-textarea"
            value={notepad.content}
            onChange={handleNotepadChange}
            placeholder="Take your notes here..."
          />
        </div>
      )}
      
      {/* Mini Drawpad Component */}
      {drawpad.isOpen && (
        <MiniDrawpad
          isOpen={drawpad.isOpen}
          position={drawpad.position}
          size={drawpad.size}
          zIndex={2000}
          onClose={() => setDrawpad(prev => ({ ...prev, isOpen: false }))}
          onFullscreen={() => window.open('/drawpad', '_blank', 'noopener,noreferrer')}
          onPositionChange={(position) => setDrawpad(prev => ({ ...prev, position }))}
          onSizeChange={(size) => setDrawpad(prev => ({ ...prev, size }))}
        />
      )}
      
      {/* OCR Tool Component */}
      {ocrTool.isOpen && (
        <OCRTool
          isOpen={ocrTool.isOpen}
          position={ocrTool.position}
          size={ocrTool.size}
          zIndex={2100}
          onClose={() => setOcrTool(prev => ({ ...prev, isOpen: false }))}
          onPositionChange={(position) => setOcrTool(prev => ({ ...prev, position }))}
          onSizeChange={(size) => setOcrTool(prev => ({ ...prev, size }))}
        />
      )}
      
      <div style={{ 
        maxWidth: '1200px', 
        margin: '20px auto', 
        padding: '20px',
        textAlign: 'center'
      }}>
        <a 
          href={getSemesterArchiveLink(resolvedSemesterId)} 
          className="archive-button"
          target="_blank"
          rel="noopener noreferrer"
        >
          OPEN S{resolvedSemesterId} GDRIVE
        </a>
        
        {semesterData.subjects.length === 0 ? (
          <div style={{ marginTop: '20px' }}>
            No subjects available for this semester yet.
          </div>
        ) : (
          semesterData.subjects.map((subject) => (
            <div key={subject.id} id={`subject-${subject.id}`} className="subject-section">
              <h3>{subject.title}</h3>
              {(subject.files && subject.files.length > 0) || (subject.lessons && subject.lessons.length > 0) ? (
                <>
                  {subject.lessons && subject.lessons.map((element) => (
                    <div key={element.id || element.title} id={`lesson-${element.id || element.title}`} className="file-item">
                      <button 
                        onClick={() => handleElementClick(element)}
                        className={`preview-button ${isFolder(element) ? 'folder-button' : 'lesson-button'}`}
                      >
                        {isFolder(element) && <span className="folder-icon">📁 </span>}
                        {element.title || "Unnamed element"}
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <div>No files available for this subject.</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer with user info and recommended tools */}
      <footer className="page-footer">
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ maxWidth: 1000, width: '100%', padding: '0 16px' }}>
            <Adsense slot={SLOT_SEM_BOTTOM} responsive style={{ display: 'block', minHeight: 60 }} format="horizontal" />
          </div>
        </div>
        <div className="user-controls">
          {userSession ? (
            <div className="user-info">
              <span>Welcome, {userSession.username}</span>
              {userSession.isAdmin && flags.admin_screen_access === 1 && (
                <Link href="/admin" className="admin-link">
                  Admin Panel
                </Link>
              )}
              <button 
                className="logout-button"
                onClick={() => {
                  localStorage.removeItem('userSession');
                  setUserSession(null);
                }}
              >
                Logout
              </button>
            </div>
          ) : (
            null
          )}
        </div>
      </footer>

    


      
      {/* Login Modal removed — UIR domain login has been removed. Normal user login is accessible via the admin panel only. */}

      <style jsx>{`
        .main-container {
          background-color: #000000;
          color: white;
          min-height: 100vh;
        }
      
         .search-section {
          max-width: 1000px;
          margin: 20px auto 30px;
          padding: 0 16px;
          background: transparent;
          border: none;
          border-radius: 0;
          box-shadow: none;
        }
        
        /* Remove absolute positioning previously used */
        .header-buttons { display: none; }

        .semester-header {
            background-color: #1c64b6;
            padding: 20px 0;
            text-align: center;
            border-radius: 10px;
            margin: 0; 
        }

        /* File Previewer Styles */
        .previewer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.85);
          z-index: 1000;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .previewer-container {
          background-color: #1e1e1e;
          width: 98%;
          height: 98%;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .previewer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px; /* compact like mini drawpad */
          background-color: #2a2a2a;
          border-bottom: 1px solid #444;
          cursor: move;
        }
        
        .notepad-header h4 {
          margin: 0;
          font-size: 12px; /* compact */
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 60%;
        }
        
        .notepad-controls {
          display: flex;
          gap: 4px; /* compact */
        }
        
        .notepad-controls button {
          padding: 4px 8px; /* slightly larger */
          font-size: 11px;
          border-radius: 6px; /* match compact style */
        }
        
        .save-button {
          background-color: #4a90e2;
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.4s;
        }
        
        .save-button:hover {
          background-color: #357ab8;
          transform: scale(1.03)
        }

        .fullscreen-button {
          background-color: #50c878 ;
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.4s;
        }
        
        .fullscreen-button:hover {
          background-color: #3da05e;
          transform: scale(1.03)
        }
        
        .notepad-textarea {
          flex: 1;
          padding: 10px;
          background-color: rgba(40, 40, 40, 0.7);
          color: white;
          border: none;
          resize: none;
          font-family: Arial, sans-serif;
          font-size: 14px;
        }
        
        .notepad-textarea:focus {
          outline: none;
        }
        

        
        .previewer-content {
          flex: 1;
          overflow: auto;
          padding: 0; /* remove extra padding so content can fill container */
          display: flex;
          justify-content: center;
          align-items: stretch; /* allow children to take full height */
        }
        
        /* Ensure Drive/iframe preview fills the modal */
        .previewer-iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
        
        .pdf-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-height: 100%; /* use full available height inside container */
        }
        
        .pdf-navigation {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          margin-top: 20px;
        }
        
        .pdf-nav-button {
          padding: 8px 16px;
          background-color: #4a90e2;
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
        }
        
        .pdf-nav-button:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }
        
        /* Preview button styles */
        .preview-button {
          padding: 8px 12px;
          background-color: #2676d2;
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          margin: 5px;
          transition: background-color 0.2s;
          display: inline-block;
          width: auto;
          min-width: fit-content;
        }
        
        .preview-button:hover {
          background-color: #1c64b6;
        }

        .preview-button.folder-button {
          background-color:rgb(91, 58, 255);
        }

        .preview-button.folder-button:hover {
          background-color: rgb(120, 94, 255);
        }

        /* Existing footer styles */
        .user-controls {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
        }
        
        .user-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .home-button, .login-button, .logout-button, .admin-link {
          padding: 8px 16px;
          background-color: #4a90e2;
          color: white;
          border: none;
          border-radius: 10px;
          text-decoration: none;
          cursor: pointer;
          font-size: 14px;
        }

        .login-button {
          background-color: #1e1e1e; /* Changed to match the tool-card background color */
        }

        .login-button:hover {
          background-color: #2a2a2a; /* Changed to match the tool-card hover color */
        }

        .logout-button:hover, .admin-link:hover {
          background-color: #357ab8;
        }

        .logout-button {
          background-color: #e25c5c;
        }

        .logout-button:hover {
          background-color: #c04545;
        }

      `}</style>
    </div>
    </>
  )
}
