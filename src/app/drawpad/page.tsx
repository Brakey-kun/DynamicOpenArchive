'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Draggable from 'react-draggable';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Pen,
  Type,
  Trash2,
  Download,
  Undo2,
  Redo2,
  Palette,
  Settings,
  ChevronDown,
  Plus,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  ChevronUp,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Home,
  ZoomIn,
  ZoomOut,
  Eraser
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Point {
  x: number;
  y: number;
}

interface DrawingPath {
  points: Point[];
  color: string;
  size: number;
  erase?: boolean;
}

interface TextBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  color: string;
}

interface Page {
  id: string;
  paths: DrawingPath[];
  textBoxes: TextBox[];
  backgroundImage?: string;
}

type Mode = 'draw' | 'text' | 'erase';
type ExportFormat = 'png' | 'jpeg' | 'pdf';

export default function DrawPad() {
  // Canvas and drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);

  // Page system state
  const [pages, setPages] = useState<Page[]>([{
    id: '1',
    paths: [],
    textBoxes: []
  }]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const router = useRouter();

  // Undo/Redo state
  const [undoStack, setUndoStack] = useState<Page[][]>([]);
  const [redoStack, setRedoStack] = useState<Page[][]>([]);

  // UI state
  const [mode, setMode] = useState<Mode>('draw');
  const [penSize, setPenSize] = useState(3);
  const [penColor, setPenColor] = useState('#000000');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [canvasDarkMode, setCanvasDarkMode] = useState(false);
  const [pointerPos, setPointerPos] = useState<Point | null>(null);

  // Text boxes state
  const [selectedTextBox, setSelectedTextBox] = useState<string | null>(null);
  const [textFontSize, setTextFontSize] = useState(16);
  const [textColor, setTextColor] = useState('#000000');

  // Get current page data
  const currentPage = pages[currentPageIndex];
  const paths = currentPage?.paths || [];
  const textBoxes = currentPage?.textBoxes || [];

  // Refs for stable callbacks
  const pagesRef = useRef(pages);
  const currentPathRef = useRef<Point[]>([]);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

  // Autosave to localStorage (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        const payload = { pages, currentPageIndex, canvasDarkMode };
        localStorage.setItem('drawpad-autosave', JSON.stringify(payload));
      } catch (e) {
        // Silently fail if storage is full
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [pages, currentPageIndex, canvasDarkMode]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('drawpad-autosave');
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.pages) && data.pages.length > 0) {
          setPages(data.pages);
          setCurrentPageIndex(Math.min(data.currentPageIndex ?? 0, data.pages.length - 1));
          if (typeof data.canvasDarkMode === 'boolean') setCanvasDarkMode(data.canvasDarkMode);
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }, []);

  // Fullscreen functionality
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!isFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen toggle failed:', error);
    }
  }, [isFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Calculate maximum canvas size based on screen dimensions
  const calculateMaxCanvasSize = useCallback(() => {
    // Get the full viewport dimensions
    // Use visualViewport if available for better mobile support (keyboard/bars)
    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;

    // Account for the compact toolbar height and margins
    const toolbarHeight = showToolbar ? 60 : 0;
    const margins = isFullscreen ? 8 : 16;
    const borderAndPadding = 8;

    // Calculate available space for the canvas
    const availableWidth = viewportWidth - margins;
    const availableHeight = viewportHeight - toolbarHeight - margins - borderAndPadding;

    // Use nearly full available space
    const maxWidth = Math.floor(availableWidth * 0.98);
    const maxHeight = Math.floor(availableHeight * 0.95);

    return {
      width: Math.max(1000, maxWidth),
      height: Math.max(600, maxHeight)
    };
  }, [showToolbar, isFullscreen]);

  // Initialize canvas with fixed maximum size
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const initializeCanvas = () => {
      const maxSize = calculateMaxCanvasSize();

      // Set canvas size only once to prevent infinite expansion
      if (canvasSize.width === 0 || canvasSize.height === 0) {
        setCanvasSize(maxSize);
        canvas.width = maxSize.width;
        canvas.height = maxSize.height;
      } else {
        canvas.width = canvasSize.width;
        canvas.height = canvasSize.height;
      }

      // Set drawing properties
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.imageSmoothingEnabled = true;

      // Clear canvas with white background
      const bgColor = canvasDarkMode ? '#2e2e2e' : '#ffffff';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Redraw current page content
      drawCurrentPage();
    };

    initializeCanvas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize, calculateMaxCanvasSize]);

  // Dynamic canvas sizing on window resize and fullscreen/toolbar changes
  useEffect(() => {
    const handleResize = () => {
      const newSize = calculateMaxCanvasSize();
      setCanvasSize(newSize);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateMaxCanvasSize]);

  // Draw current page content
  const drawCurrentPage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill background first so eraser holes show the correct background color
    const bgColor = canvasDarkMode ? '#2e2e2e' : '#ffffff';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawPaths = () => {
      paths.forEach((path) => {
        if (path.points.length < 2) return;
        ctx.globalCompositeOperation = path.erase ? 'destination-out' : 'source-over';
        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (path.points.length === 2) {
          ctx.moveTo(path.points[0].x, path.points[0].y);
          ctx.lineTo(path.points[1].x, path.points[1].y);
        } else {
          // Smooth quadratic bezier through midpoints
          ctx.moveTo(path.points[0].x, path.points[0].y);
          for (let i = 1; i < path.points.length - 1; i++) {
            const midX = (path.points[i].x + path.points[i + 1].x) / 2;
            const midY = (path.points[i].y + path.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(path.points[i].x, path.points[i].y, midX, midY);
          }
          const last = path.points[path.points.length - 1];
          ctx.lineTo(last.x, last.y);
        }
        ctx.stroke();
      });
      ctx.globalCompositeOperation = 'source-over';
    };
    drawPaths();

    const bg = currentPage?.backgroundImage;
    if (bg) {
      const img = new Image();
      img.onload = () => {
        const iw = img.width;
        const ih = img.height;
        const cw = canvas.width;
        const ch = canvas.height;
        const scale = Math.min(cw / iw, ch / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
      };
      img.src = bg;
    }
  }, [paths, canvasDarkMode, currentPage]);


  // Redraw when page changes
  useEffect(() => {
    drawCurrentPage();
  }, [drawCurrentPage, currentPageIndex]);

  // Get mouse/touch position relative to canvas
  const getEventPos = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return { x: 0, y: 0 };
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  }, [zoom]);

  // Drawing event handlers
  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'draw' && mode !== 'erase') return;

    e.preventDefault();
    const pos = getEventPos(e);
    if (mode === 'erase') {
      setPointerPos(pos);
    }
    setIsDrawing(true);
    setCurrentPath([pos]);
    currentPathRef.current = [pos];
  }, [mode, getEventPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Always update eraser cursor position when in erase mode
    const pos = getEventPos(e);
    if (mode === 'erase') {
      setPointerPos(pos);
    }

    if (!isDrawing || (mode !== 'draw' && mode !== 'erase')) return;

    e.preventDefault();
    currentPathRef.current = [...currentPathRef.current, pos];
    setCurrentPath(currentPathRef.current);

    // Draw current stroke in real-time using smooth quadratic bezier
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = mode === 'erase' ? 'rgba(0,0,0,1)' : penColor;
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Use quadratic bezier smoothing: draw through midpoints
    const pts = currentPathRef.current;
    if (pts.length >= 3) {
      const prev2 = pts[pts.length - 3];
      const prev1 = pts[pts.length - 2];
      const curr = pts[pts.length - 1];
      const midX = (prev1.x + curr.x) / 2;
      const midY = (prev1.y + curr.y) / 2;
      ctx.beginPath();
      ctx.moveTo((prev2.x + prev1.x) / 2, (prev2.y + prev1.y) / 2);
      ctx.quadraticCurveTo(prev1.x, prev1.y, midX, midY);
      ctx.stroke();
    } else if (pts.length === 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }, [isDrawing, mode, getEventPos, penColor, penSize]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing || currentPathRef.current.length === 0) return;

    // Save current state for undo (cap at 30 entries)
    const currentPages = pagesRef.current;
    setUndoStack(prev => {
      const next = [...prev, currentPages];
      return next.length > 30 ? next.slice(next.length - 30) : next;
    });
    setRedoStack([]);

    // Add completed path to current page
    const newPath: DrawingPath = {
      points: currentPathRef.current,
      color: penColor,
      size: penSize,
      erase: mode === 'erase',
    };

    setPages(prev => prev.map((page, index) =>
      index === currentPageIndex
        ? { ...page, paths: [...page.paths, newPath] }
        : page
    ));

    currentPathRef.current = [];
    setCurrentPath([]);
    setIsDrawing(false);
  }, [isDrawing, currentPageIndex, penColor, penSize, mode]);

  const handleMouseLeave = useCallback(() => {
    // Stop any active stroke and hide the eraser ring when leaving canvas
    if (isDrawing) {
      stopDrawing();
    }
    setPointerPos(null);
  }, [isDrawing, stopDrawing]);

  // Text box handlers
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (mode !== 'text') return;

    // Save undo state before adding text box
    setUndoStack(prev => [...prev, pagesRef.current]);
    setRedoStack([]);

    const pos = getEventPos(e);
    const newTextBox: TextBox = {
      id: Date.now().toString(),
      x: pos.x,
      y: pos.y,
      width: 200,
      height: 40,
      text: 'Click to edit',
      fontSize: textFontSize,
      color: textColor,
    };

    setPages(prev => prev.map((page, index) =>
      index === currentPageIndex
        ? { ...page, textBoxes: [...page.textBoxes, newTextBox] }
        : page
    ));
    setSelectedTextBox(newTextBox.id);
  }, [mode, getEventPos, textFontSize, textColor, currentPageIndex]);

  const updateTextBox = useCallback((id: string, updates: Partial<TextBox>) => {
    setPages(prev => prev.map((page, index) =>
      index === currentPageIndex
        ? {
          ...page, textBoxes: page.textBoxes.map(box =>
            box.id === id ? { ...box, ...updates } : box
          )
        }
        : page
    ));
  }, [currentPageIndex]);

  const deleteTextBox = useCallback((id: string) => {
    setUndoStack(prev => [...prev, pagesRef.current]);
    setRedoStack([]);
    setPages(prev => prev.map((page, index) =>
      index === currentPageIndex
        ? { ...page, textBoxes: page.textBoxes.filter(box => box.id !== id) }
        : page
    ));
    setSelectedTextBox(null);
  }, [currentPageIndex]);

  // Page management functions
  const addNewPage = useCallback(() => {
    const newPage: Page = {
      id: (pages.length + 1).toString(),
      paths: [],
      textBoxes: []
    };
    setPages(prev => [...prev, newPage]);
    setCurrentPageIndex(pages.length);
  }, [pages.length]);

  const goToPage = useCallback((index: number) => {
    if (index >= 0 && index < pages.length) {
      setCurrentPageIndex(index);
      setSelectedTextBox(null);
    }
  }, [pages.length]);

  // Undo/Redo
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, pages]);
    setPages(previousState);
    setUndoStack(prev => prev.slice(0, -1));
  }, [undoStack, pages]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, pages]);
    setPages(nextState);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, pages]);

  // Keyboard shortcuts: Undo/Redo (Ctrl/Cmd+Z for undo, Ctrl/Cmd+Y or Shift+Z for redo)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Do not intercept when typing in inputs/textarea/contentEditable
      const isTextField = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        (target as HTMLElement).isContentEditable === true
      );
      if (isTextField) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && ((key === 'y') || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [undo, redo]);

  // Clear current page
  const clearAll = useCallback(() => {
    setUndoStack(prev => [...prev, pagesRef.current]);
    setRedoStack([]);
    setPages(prev => prev.map((page, index) =>
      index === currentPageIndex
        ? { ...page, paths: [], textBoxes: [] }
        : page
    ));
    setSelectedTextBox(null);
  }, [currentPageIndex]);

  // Export functions
  const exportAs = useCallback(async (format: ExportFormat) => {
    const container = containerRef.current;
    if (!container) return;

    try {
      const canvas = await html2canvas(container, {
        backgroundColor: canvasDarkMode ? '#2e2e2e' : '#ffffff',
        scale: 2,
        useCORS: true,
      });

      if (format === 'pdf') {
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height],
        });

        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save('drawpad.pdf');
      } else {
        const link = document.createElement('a');
        link.download = `drawpad.${format}`;
        link.href = canvas.toDataURL(`image/${format}`, 0.9);
        link.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }

    setShowExportMenu(false);
  }, [canvasDarkMode]);

  // Import handlers
  const importImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPages(prev => prev.map((page, index) => index === currentPageIndex ? { ...page, backgroundImage: dataUrl } : page));
    };
    reader.readAsDataURL(file);
    setShowImportMenu(false);
  }, [currentPageIndex]);

  const importStructured = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (Array.isArray(data.pages)) {
          setPages(data.pages);
          setCurrentPageIndex(Math.min(data.currentPageIndex ?? 0, data.pages.length - 1));
          if (typeof data.canvasDarkMode === 'boolean') setCanvasDarkMode(data.canvasDarkMode);
        }
      } catch (err) {
        console.error('Structured import failed:', err);
        alert('Invalid structured file.');
      }
    };
    reader.readAsText(file);
    setShowImportMenu(false);
  }, []);

  const exportStructured = useCallback(() => {
    const structured = {
      pages,
      currentPageIndex,
      canvasDarkMode,
    };
    const blob = new Blob([JSON.stringify(structured)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'drawpad.json';
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [pages, currentPageIndex, canvasDarkMode]);

  return (
    <div className={`h-screen w-screen flex flex-col bg-gradient-to-br from-neutral-900 to-neutral-800 text-neutral-200 overflow-hidden ${isFullscreen ? 'bg-black' : ''}`}>
      {/* Compact Horizontal Toolbar */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out ${showToolbar ? 'translate-y-0' : '-translate-y-full'
        }`}>
        <div className="bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-700 shadow-lg overflow-x-auto no-scrollbar">
          <div className="px-3 py-2 min-w-max">
            <div className="flex items-center justify-between gap-4">
              {/* Left Section - Mode & Tools */}
              <div className="flex items-center gap-1">
                {/* Mode Toggle */}
                <div className="flex bg-neutral-800 rounded-lg p-1">
                  <button
                    onClick={() => setMode('draw')}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-1 ${mode === 'draw'
                        ? 'bg-neutral-700 text-blue-300 shadow-sm'
                        : 'text-neutral-300 hover:text-white'
                      }`}
                  >
                    <Pen size={14} />
                    <span className="hidden sm:inline">Draw</span>
                  </button>
                  <button
                    onClick={() => setMode('text')}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-1 ${mode === 'text'
                        ? 'bg-neutral-700 text-blue-300 shadow-sm'
                        : 'text-neutral-300 hover:text-white'
                      }`}
                  >
                    <Type size={14} />
                    <span className="hidden sm:inline">Text</span>
                  </button>
                  <button
                    onClick={() => setMode('erase')}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-1 ${mode === 'erase'
                        ? 'bg-neutral-700 text-blue-300 shadow-sm'
                        : 'text-neutral-300 hover:text-white'
                      }`}
                  >
                    <Eraser size={14} />
                    <span className="hidden sm:inline">Erase</span>
                  </button>
                </div>

                {/* Size Control */}
                <div className="flex items-center gap-1 px-2">
                  <Settings size={12} className="text-neutral-300" />
                  <input
                    type="range"
                    min={mode === 'text' ? "12" : "1"}
                    max={mode === 'text' ? "48" : "40"}
                    value={mode === 'text' ? textFontSize : penSize}
                    onChange={(e) => mode === 'text' ? setTextFontSize(Number(e.target.value)) : setPenSize(Number(e.target.value))}
                    className="w-12 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-xs font-mono text-neutral-300 w-4 text-center">
                    {mode === 'text' ? textFontSize : penSize}
                  </span>
                </div>

                {/* Color Picker */}
                <div className="flex items-center gap-1">
                  <Palette size={12} className="text-neutral-300" />
                  <input
                    type="color"
                    value={mode === 'text' ? textColor : penColor}
                    onChange={(e) => mode === 'text' ? setTextColor(e.target.value) : setPenColor(e.target.value)}
                    className="w-6 h-6 rounded border border-neutral-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Center Section - Page Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(currentPageIndex - 1)}
                  disabled={currentPageIndex === 0}
                  className="p-1 rounded text-neutral-300 hover:text-white hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Previous Page"
                >
                  <ChevronLeft size={14} />
                </button>

                <div className="px-2 py-1 bg-neutral-800 rounded text-xs font-medium text-neutral-200">
                  {currentPageIndex + 1}/{pages.length}
                </div>

                <button
                  onClick={() => goToPage(currentPageIndex + 1)}
                  disabled={currentPageIndex === pages.length - 1}
                  className="p-1 rounded text-neutral-300 hover:text-white hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Next Page"
                >
                  <ChevronRight size={14} />
                </button>

                <button
                  onClick={addNewPage}
                  className="p-1 rounded bg-blue-900/30 text-blue-300 hover:bg-blue-900/40"
                  title="Add Page"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Right Section - Actions */}
              <div className="flex items-center gap-1">
                {/* Home */}
                <button
                  onClick={() => router.push('/')}
                  className="px-2 py-1 rounded bg-neutral-800 text-neutral-200 hover:bg-neutral-700 text-xs font-medium flex items-center gap-1"
                  title="Home"
                >
                  <Home size={14} />
                  <span className="hidden sm:inline">Home</span>
                </button>

                {/* Zoom controls */}
                <div className="flex items-center gap-1 px-1">
                  <button
                    onClick={() => setZoom(prev => Math.max(0.5, Number((prev - 0.1).toFixed(2))))}
                    className="p-1 rounded text-neutral-300 hover:text-white hover:bg-neutral-700"
                    title="Zoom Out"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <div className="px-2 py-1 bg-neutral-800 rounded text-xs font-medium text-neutral-200 min-w-[52px] text-center">
                    {Math.round(zoom * 100)}%
                  </div>
                  <button
                    onClick={() => setZoom(prev => Math.min(2, Number((prev + 0.1).toFixed(2))))}
                    className="p-1 rounded text-neutral-300 hover:text-white hover:bg-neutral-700"
                    title="Zoom In"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>
                {/* Undo/Redo */}
                <button
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  className="p-1 rounded text-neutral-300 hover:text-white hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Undo"
                >
                  <Undo2 size={14} />
                </button>

                <button
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  className="p-1 rounded text-neutral-300 hover:text-white hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Redo"
                >
                  <Redo2 size={14} />
                </button>

                {/* Clear */}
                <button
                  onClick={clearAll}
                  className="px-2 py-1 rounded bg-red-900/30 text-red-300 hover:bg-red-900/40 text-xs font-medium flex items-center gap-1"
                  title="Clear Page"
                >
                  <Trash2 size={14} />
                  <span className="hidden sm:inline">Clear</span>
                </button>

                {/* Import */}
                <div className="relative">
                  <button
                    onClick={() => { setShowImportMenu(!showImportMenu); setShowExportMenu(false); }}
                    className="px-2 py-1 rounded bg-indigo-900/30 text-indigo-300 hover:bg-indigo-900/40 text-xs font-medium flex items-center gap-1"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">Import</span>
                    <ChevronDown size={12} className={`transition-transform duration-200 ${showImportMenu ? 'rotate-180' : ''}`} />
                  </button>
                  {showImportMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-20 min-w-[160px] overflow-hidden">
                      <div className="py-1">
                        <label className="block w-full px-3 py-2 text-left text-xs text-neutral-200 hover:bg-neutral-800 cursor-pointer">
                          Import Image
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) importImage(file);
                          }} />
                        </label>
                        <label className="block w-full px-3 py-2 text-left text-xs text-neutral-200 hover:bg-neutral-800 cursor-pointer">
                          Import Structured (.json/.drw)
                          <input type="file" accept=".json,.drw" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) importStructured(file);
                          }} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Export */}
                <div className="relative">
                  <button
                    onClick={() => { setShowExportMenu(!showExportMenu); setShowImportMenu(false); }}
                    className="px-2 py-1 rounded bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/40 text-xs font-medium flex items-center gap-1"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">Export</span>
                    <ChevronDown size={12} className={`transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-20 min-w-[140px] overflow-hidden">
                      <div className="py-1">
                        <button
                          onClick={() => exportAs('png')}
                          className="block w-full px-3 py-2 text-left text-xs text-neutral-200 hover:bg-neutral-800"
                        >
                          Export as PNG
                        </button>
                        <button
                          onClick={() => exportAs('jpeg')}
                          className="block w-full px-3 py-2 text-left text-xs text-neutral-200 hover:bg-neutral-800"
                        >
                          Export as JPEG
                        </button>
                        <button
                          onClick={() => exportAs('pdf')}
                          className="block w-full px-3 py-2 text-left text-xs text-neutral-200 hover:bg-neutral-800"
                        >
                          Export as PDF
                        </button>
                        <button
                          onClick={exportStructured}
                          className="block w-full px-3 py-2 text-left text-xs text-neutral-200 hover:bg-neutral-800"
                        >
                          Export Structured (.json)
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Canvas background mode toggle */}
                <button
                  onClick={() => setCanvasDarkMode(!canvasDarkMode)}
                  className="px-2 py-1 rounded bg-neutral-800 text-neutral-200 hover:bg-neutral-700 text-xs font-medium flex items-center gap-1"
                  title={canvasDarkMode ? "Canvas light background" : "Canvas dark background"}
                >
                  {canvasDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                  <span className="hidden sm:inline">{canvasDarkMode ? 'Light Canvas' : 'Dark Canvas'}</span>
                </button>

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="p-1 rounded bg-purple-900/30 text-purple-300 hover:bg-purple-900/40"
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar Toggle Button */}
      <button
        onClick={() => setShowToolbar(!showToolbar)}
        className={`fixed top-2 right-2 z-50 p-2 bg-neutral-800/90 backdrop-blur-sm rounded-lg shadow-lg border border-neutral-700 hover:bg-neutral-700 transition-all duration-200 ${showToolbar ? 'translate-y-12' : 'translate-y-0'
          }`}
        title={showToolbar ? "Hide Toolbar" : "Show Toolbar"}
      >
        {showToolbar ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>

      {/* Main Drawing Area */}
      <div className={`flex-1 flex items-center justify-center overflow-hidden transition-all duration-300 ${showToolbar ? 'pt-16' : 'pt-2'
        } ${isFullscreen ? 'p-1' : 'p-2'}`}>
        <div
          ref={containerRef}
          className="relative bg-neutral-900 rounded-lg shadow-xl border border-neutral-700 overflow-hidden"
          style={{
            width: (canvasSize.width || 0) * zoom,
            height: (canvasSize.height || 0) * zoom,
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              width: canvasSize.width || 0,
              height: canvasSize.height || 0,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left'
            }}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={handleMouseLeave}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              onClick={handleCanvasClick}
              style={{
                cursor: mode === 'erase' ? 'none' : (mode === 'draw' ? 'crosshair' : 'text'),
                backgroundColor: canvasDarkMode ? '#2e2e2e' : '#ffffff'
              }}
            />

            {mode === 'erase' && pointerPos && (
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  left: pointerPos.x - penSize / 2,
                  top: pointerPos.y - penSize / 2,
                  width: penSize,
                  height: penSize,
                  border: `2px solid ${canvasDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)'}`,
                  boxShadow: canvasDarkMode
                    ? '0 0 0 1px rgba(0,0,0,0.2)'
                    : '0 0 0 1px rgba(255,255,255,0.2)'
                }}
              />
            )}

            {/* Text boxes */}
            {textBoxes.map((textBox) => (
              <Draggable
                key={textBox.id}
                defaultPosition={{ x: textBox.x * zoom, y: textBox.y * zoom }}
                onStop={(e, data) => {
                  updateTextBox(textBox.id, { x: Math.round(data.x / zoom), y: Math.round(data.y / zoom) });
                }}
              >
                <div
                  className={`absolute border-2 rounded-lg transition-all duration-200 ${selectedTextBox === textBox.id
                      ? 'border-blue-400 shadow-lg shadow-blue-100'
                      : 'border-transparent hover:border-slate-300 hover:shadow-md'
                    } bg-transparent cursor-move group`}
                  style={{
                    width: textBox.width,
                    height: textBox.height,
                  }}
                  onClick={() => setSelectedTextBox(textBox.id)}
                >
                  <textarea
                    value={textBox.text}
                    onChange={(e) => updateTextBox(textBox.id, { text: e.target.value })}
                    className="w-full h-full resize-none border-none outline-none bg-transparent p-2 rounded-lg"
                    style={{
                      fontSize: `${textBox.fontSize}px`,
                      color: textBox.color,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                    placeholder="Type here..."
                  />
                  {selectedTextBox === textBox.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTextBox(textBox.id);
                      }}
                      className="absolute -top-3 -right-3 w-7 h-7 bg-red-500 text-white rounded-full text-sm hover:bg-red-600 transition-colors duration-200 flex items-center justify-center shadow-lg"
                    >
                      ×
                    </button>
                  )}
                  {/* Resize handle */}
                  <div
                    className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-tl-lg"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const startWidth = textBox.width;
                      const startHeight = textBox.height;

                      const handleMouseMove = (e: MouseEvent) => {
                        const newWidth = Math.max(100, startWidth + (e.clientX - startX) / zoom);
                        const newHeight = Math.max(30, startHeight + (e.clientY - startY) / zoom);
                        updateTextBox(textBox.id, { width: newWidth, height: newHeight });
                      };

                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                      };

                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                  />
                </div>
              </Draggable>
            ))}
          </div>
        </div>
      </div>

      {/* Click outside to deselect text boxes */}
      {selectedTextBox && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setSelectedTextBox(null)}
        />
      )}

      {/* Custom CSS for sliders */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .slider::-moz-range-thumb {
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );


}