"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";

export interface MiniDrawpadProps {
  isOpen: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex?: number;
  onClose: () => void;
  onFullscreen: () => void;
  onPositionChange: (pos: { x: number; y: number }) => void;
  onSizeChange: (size: { width: number; height: number }) => void;
}

// Helper to clamp values
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

// Default number of pages to start with
const INITIAL_PAGES = 1;

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

type Tool = 'pen' | 'eraser';

const MiniDrawpad: React.FC<MiniDrawpadProps> = ({
  isOpen,
  position,
  size,
  zIndex = 2000,
  onClose,
  onFullscreen,
  onPositionChange,
  onSizeChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPointerDownRef = useRef<boolean>(false);

  // State for vector-based strokes
  const [pages, setPages] = useState<Stroke[][]>(() => new Array(INITIAL_PAGES).fill([]));
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [hoveredStrokeIndex, setHoveredStrokeIndex] = useState<number | null>(null);

  // Current stroke being drawn
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Dragging state
  const dragState = useRef<{ dragging: boolean; startX: number; startY: number }>({ dragging: false, startX: 0, startY: 0 });

  // Resizing state
  const resizeState = useRef<{ resizing: boolean; startX: number; startY: number; startW: number; startH: number }>({
    resizing: false,
    startX: 0,
    startY: 0,
    startW: size.width,
    startH: size.height,
  });

  // Helper to check if a point is near a segment
  const isPointNearSegment = (p: Point, a: Point, b: Point, threshold: number): boolean => {
    const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    if (l2 === 0) return (p.x - a.x) ** 2 + (p.y - a.y) ** 2 < threshold ** 2;
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const distSq = (p.x - (a.x + t * (b.x - a.x))) ** 2 + (p.y - (a.y + t * (b.y - a.y))) ** 2;
    return distSq < threshold ** 2;
  };

  // Helper to redraw the entire canvas from strokes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const strokes = pages[pageIndex] || [];

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    strokes.forEach((stroke, index) => {
      if (stroke.points.length < 2 && stroke.points.length > 0) {
        // Draw dot
        ctx.beginPath();
        ctx.fillStyle = stroke.color;
        if (index === hoveredStrokeIndex && currentTool === 'eraser') {
          ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
          ctx.shadowColor = "red";
          ctx.shadowBlur = 10;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (stroke.points.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;

      if (index === hoveredStrokeIndex && currentTool === 'eraser') {
        ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
        ctx.shadowColor = "red";
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset
    });
  }, [pages, pageIndex, hoveredStrokeIndex, currentTool]);

  // Update canvas size when wrapper size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Add some padding for header height; canvas fills remaining content area
    const headerHeight = 40;
    canvas.width = Math.max(300, Math.floor(size.width));
    canvas.height = Math.max(160, Math.floor(size.height - headerHeight));

    redrawCanvas();
  }, [size.width, size.height, redrawCanvas]);

  // Redraw when page changes
  useEffect(() => {
    redrawCanvas();
  }, [pageIndex, redrawCanvas]);

  // Drawing handlers
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    isPointerDownRef.current = true;

    const { offsetX, offsetY } = e.nativeEvent;

    if (currentTool === 'pen') {
      currentStrokeRef.current = {
        points: [{ x: offsetX, y: offsetY }],
        color: "#000000",
        width: 2
      };
      // Draw the starting dot
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(offsetX, offsetY, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (currentTool === 'eraser') {
      // Check for erasure immediately on click
      checkForErasure(offsetX, offsetY);
    }
  }, [currentTool]);

  // We need latest pages for eraser.
  const pagesRef = useRef(pages);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const checkForErasure = useCallback((x: number, y: number) => {
    const currentPages = pagesRef.current;
    const currentStrokes = currentPages[pageIndex];
    let didErase = false;

    const newStrokes = currentStrokes.filter(stroke => {
      // Check if any segment of the stroke is near the eraser point
      for (let i = 0; i < stroke.points.length - 1; i++) {
        if (isPointNearSegment({ x, y }, stroke.points[i], stroke.points[i + 1], 10)) {
          didErase = true;
          return false; // Remove this stroke
        }
      }
      // Also check single points (dots)
      if (stroke.points.length === 1) {
        const dist = Math.hypot(stroke.points[0].x - x, stroke.points[0].y - y);
        if (dist < 10) {
          didErase = true;
          return false;
        }
      }
      return true; // Keep stroke
    });

    if (didErase) {
      setPages(prev => {
        const next = [...prev];
        next[pageIndex] = newStrokes;
        return next;
      });
      setHoveredStrokeIndex(null); // Clear hover after delete
    }
  }, [pageIndex]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { offsetX, offsetY } = e.nativeEvent;

    if (currentTool === 'eraser') {
      // Check for hover
      const currentStrokes = pagesRef.current[pageIndex] || [];
      let foundIndex: number | null = null;

      // Iterate in reverse to find top-most stroke first
      for (let i = currentStrokes.length - 1; i >= 0; i--) {
        const stroke = currentStrokes[i];
        let hit = false;
        for (let j = 0; j < stroke.points.length - 1; j++) {
          if (isPointNearSegment({ x: offsetX, y: offsetY }, stroke.points[j], stroke.points[j + 1], 10)) {
            hit = true;
            break;
          }
        }
        if (!hit && stroke.points.length === 1) {
          const dist = Math.hypot(stroke.points[0].x - offsetX, stroke.points[0].y - offsetY);
          if (dist < 10) hit = true;
        }

        if (hit) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex !== hoveredStrokeIndex) {
        setHoveredStrokeIndex(foundIndex);
      }

      if (isPointerDownRef.current) {
        checkForErasure(offsetX, offsetY);
      }
    }

    if (!isPointerDownRef.current) return;

    if (currentTool === 'pen') {
      const stroke = currentStrokeRef.current;
      if (!stroke) return;

      const lastPoint = stroke.points[stroke.points.length - 1];
      stroke.points.push({ x: offsetX, y: offsetY });

      // Draw segment
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
      }
    }
  }, [currentTool, checkForErasure, hoveredStrokeIndex, pageIndex]);

  const onPointerUpOrLeave = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) canvas.releasePointerCapture(e.pointerId);

    if (currentTool === 'pen' && currentStrokeRef.current) {
      // Commit the stroke
      const newStroke = currentStrokeRef.current;
      setPages(prev => {
        const next = [...prev];
        next[pageIndex] = [...(next[pageIndex] || []), newStroke];
        return next;
      });
      currentStrokeRef.current = null;
    }
  }, [currentTool, pageIndex]);

  // Page navigation
  const goPrevPage = useCallback(() => {
    setPageIndex((idx) => clamp(idx - 1, 0, pages.length - 1));
  }, [pages.length]);

  const goNextPage = useCallback(() => {
    setPages((prev) => {
      const idx = pageIndex + 1;
      if (idx >= prev.length) {
        return [...prev, []];
      }
      return prev;
    });
    setPageIndex((idx) => idx + 1);
  }, [pageIndex]);

  // Export current canvas as PNG
  const exportCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      // We need to ensure the canvas is up to date (it should be)
      const dataURL = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataURL;
      link.download = `drawpad-page-${pageIndex + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // ignore
    }
  }, [pageIndex]);

  // Dragging logic for header
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const onMouseDown = (e: MouseEvent) => {
      dragState.current = {
        dragging: true,
        startX: e.clientX - position.x,
        startY: e.clientY - position.y,
      };
      if (containerRef.current) {
        containerRef.current.style.zIndex = String(zIndex);
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragState.current.dragging) return;
      const newX = e.clientX - dragState.current.startX;
      const newY = e.clientY - dragState.current.startY;
      onPositionChange({ x: newX, y: newY });
    };
    const onMouseUp = () => {
      dragState.current.dragging = false;
    };

    header.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      header.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [onPositionChange, position.x, position.y, zIndex]);

  // Resizer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizer = container.querySelector<HTMLDivElement>(".mini-drawpad-resizer");
    if (!resizer) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      resizeState.current = {
        resizing: true,
        startX: e.clientX,
        startY: e.clientY,
        startW: size.width,
        startH: size.height,
      };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!resizeState.current.resizing) return;
      const dx = e.clientX - resizeState.current.startX;
      const dy = e.clientY - resizeState.current.startY;
      const newW = clamp(resizeState.current.startW + dx, 300, window.innerWidth);
      const newH = clamp(resizeState.current.startH + dy, 200, window.innerHeight);
      onSizeChange({ width: newW, height: newH });
    };
    const onMouseUp = () => {
      resizeState.current.resizing = false;
    };

    resizer.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      resizer.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [onSizeChange, size.width, size.height]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed rounded-xl shadow-2xl border border-white/10 backdrop-blur-md overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex,
        backgroundColor: "rgba(30,30,30,0.95)",
      }}
    >
      {/* Header Bar */}
      <div
        ref={headerRef}
        className="flex items-center justify-between px-3 h-10 border-b border-gray-600 bg-[#2a2a2a] text-white cursor-move select-none"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Mini Drawpad</span>
          <span className="text-xs opacity-70">Page {pageIndex + 1} / {pages.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            title="Pen Tool"
            className={`px-3 py-1.5 rounded text-white text-sm ${currentTool === 'pen' ? 'bg-blue-700 ring-1 ring-white' : 'bg-gray-600 hover:bg-gray-500'}`}
            onClick={() => setCurrentTool('pen')}
          >
            ✎
          </button>
          <button
            title="Eraser Tool (Object Eraser)"
            className={`px-3 py-1.5 rounded text-white text-sm ${currentTool === 'eraser' ? 'bg-red-700 ring-1 ring-white' : 'bg-gray-600 hover:bg-gray-500'}`}
            onClick={() => setCurrentTool('eraser')}
          >
            ⌫
          </button>
          <div className="w-px h-4 bg-gray-500 mx-1"></div>
          <button
            title="Previous Page"
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm"
            onClick={goPrevPage}
            disabled={pageIndex === 0}
          >
            ◀
          </button>
          <button
            title="Next Page"
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm"
            onClick={goNextPage}
          >
            ▶
          </button>
          <button
            title="Fullscreen"
            className="px-3 py-1.5 rounded bg-[#064e3b] hover:bg-[#0a6b52] text-white text-sm"
            onClick={onFullscreen}
          >
            ⛶
          </button>
          <button
            title="Export PNG"
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm"
            onClick={exportCanvas}
          >
            Export
          </button>
          <button
            title="Close"
            className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-sm"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      {/* Canvas Body */}
      <div className="w-full" style={{ height: `calc(${size.height}px - 40px)` }}>
        <canvas
          ref={canvasRef}
          className={`w-full h-full bg-white ${currentTool === 'eraser' ? 'cursor-crosshair' : 'cursor-crosshair'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUpOrLeave}
          onPointerLeave={onPointerUpOrLeave}
        />
      </div>

      {/* Resizer handle */}
      <div className="mini-drawpad-resizer absolute right-1 bottom-1 w-4 h-4 cursor-se-resize" style={{
        borderRight: "2px solid #888",
        borderBottom: "2px solid #888",
      }} />
    </div>
  );
};

export default MiniDrawpad;