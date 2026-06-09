"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { MonitorPlay } from "lucide-react";
import { DiagramType, ShapeType, Shape, Connection, FloatingText, Tool, COLORS, Layer, ProjectSave, HistoryEntry, CanvasTransform, GRID_SIZE, snapToGrid } from "./types";
import { calculatePath, getEndpointMarkerSVG, getDefaultEndpoints } from "./utils/connectionUtils";
import { getContrastingColor } from "./utils/colorUtils";
import { exportProject, importProject } from "./utils/fileUtils";
import { useHistory } from "./hooks/useHistory";
import { saveHistoryEntry, generateHistoryEntry } from "./utils/historyStorage";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { ShapeRenderer } from "./components/ShapeRenderer";
import { FloatingQuickEditMenu } from "./components/FloatingQuickEditMenu";
import { LayersPanel } from "./components/LayersPanel";
import { DiagramTranslatorModal } from "./components/DiagramTranslatorModal";
import { ProjectHistoryModal } from "./components/ProjectHistoryModal";
import html2canvas from "html2canvas";

export type SelectionItem = { type: "shape" | "text" | "connection"; id: string };

const DEFAULT_LAYER: Layer = { id: 'layer-1', name: 'Layer 1', visible: true, locked: false };

const escSvg = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SchemaDrawerPage: React.FC = () => {

    // State
    const [diagramType, setDiagramType] = useState<DiagramType>("general");
    const [layers, setLayers] = useState<Layer[]>([DEFAULT_LAYER]);
    const [activeLayerId, setActiveLayerId] = useState<string>(DEFAULT_LAYER.id);
    const [shapes, setShapes] = useState<Shape[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [texts, setTexts] = useState<FloatingText[]>([]);
    const [tool, setTool] = useState<Tool>("select");
    const [selectedColor, setSelectedColor] = useState<string>("#4b5563");
    const [selectedTextColor, setSelectedTextColor] = useState<string>("#ffffff");
    
    // Multi-selection state
    const [selection, setSelection] = useState<SelectionItem[]>([]);
    const [canvasCursor, setCanvasCursor] = useState<string>('default');

    // Pan & Zoom state
    const [transform, setTransform] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

    // Snap to grid
    const [snapEnabled, setSnapEnabled] = useState(true);

    // Marquee selection
    const [marquee, setMarquee] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);

    // Modals & Panels State
    const [layersPanelOpen, setLayersPanelOpen] = useState(false);
    const [translatorOpen, setTranslatorOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);

    // Drawing Connection State
    const [drawingConnection, setDrawingConnection] = useState<{ fromId: string; fromLayerId: string; currentX: number; currentY: number; type: "straight" | "orthogonal" | "freeform"; dashed: boolean; waypoints?: {x:number, y:number}[] } | null>(null);
    const [connectionErrorTargetId, setConnectionErrorTargetId] = useState<string | null>(null);

    // Refs for interactions
    const canvasRef = useRef<HTMLDivElement>(null);
    const resizingShapeRef = useRef<{ id: string; startX: number; startY: number; startW: number; startH: number } | null>(null);
    const drawingNewShapeRef = useRef<{ id: string; startX: number; startY: number; dragged: boolean } | null>(null);

    // Multi-item dragging refs
    const movingItemsRef = useRef<{ id: string; type: "shape" | "text"; initX: number; initY: number }[]>([]);
    const moveStartRef = useRef<{ x: number; y: number } | null>(null);

    // Refs to access latest state in callbacks without recreating them
    const shapesRef = useRef(shapes);
    const toolRef = useRef(tool);
    const selectionRef = useRef(selection);
    const textsRef = useRef(texts);

    useEffect(() => { shapesRef.current = shapes; }, [shapes]);
    useEffect(() => { toolRef.current = tool; }, [tool]);
    useEffect(() => { selectionRef.current = selection; }, [selection]);
    useEffect(() => { textsRef.current = texts; }, [texts]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial Load from localStorage
    useEffect(() => {
        const savedData = localStorage.getItem("schema-drawer-autosave");
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed.diagramType) setDiagramType(parsed.diagramType);
                if (parsed.layers) {
                    setLayers(parsed.layers);
                    setActiveLayerId(parsed.layers[parsed.layers.length - 1]?.id || 'layer-1');
                }
                if (parsed.shapes) setShapes(parsed.shapes);
                if (parsed.connections) setConnections(parsed.connections);
                if (parsed.texts) setTexts(parsed.texts);
            } catch (e) {
                console.error("Failed to parse schema autosave", e);
            }
        }
    }, []);

    // Autosave on changes
    useEffect(() => {
        const payload: any = { version: "1.0", diagramType, shapes, connections, texts, layers };
        localStorage.setItem("schema-drawer-autosave", JSON.stringify(payload));
    }, [shapes, connections, texts, layers, diagramType]);

    const generateId = () => Math.random().toString(36).substring(2, 9);

    const { history, addToHistory, undo, redo } = useHistory(shapes, setShapes, connections, setConnections, texts, setTexts, layers, setLayers);

    useEffect(() => {
        if (history.length === 0) {
            addToHistory();
        }
    }, [addToHistory, history.length]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
                // Copy selected shapes
                const tag = document.activeElement?.tagName.toLowerCase();
                if (tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) return;
                const safeSel = selectionRef.current || [];
                const shapeIds = new Set(safeSel.filter(s => s.type === "shape").map(s => s.id));
                const textIds = new Set(safeSel.filter(s => s.type === "text").map(s => s.id));
                if (shapeIds.size > 0 || textIds.size > 0) {
                    const clipboard = {
                        shapes: shapesRef.current.filter(s => shapeIds.has(s.id)),
                        texts: textsRef.current.filter(t => textIds.has(t.id)),
                    };
                    localStorage.setItem('schema-drawer-clipboard', JSON.stringify(clipboard));
                }
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
                // Paste
                const tag = document.activeElement?.tagName.toLowerCase();
                if (tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) return;
                try {
                    const clipData = localStorage.getItem('schema-drawer-clipboard');
                    if (clipData) {
                        const { shapes: clipShapes, texts: clipTexts } = JSON.parse(clipData);
                        const newSelection: SelectionItem[] = [];
                        if (clipShapes?.length) {
                            const newShapes = clipShapes.map((s: Shape) => {
                                const newId = generateId();
                                newSelection.push({ type: 'shape', id: newId });
                                return { ...s, id: newId, x: s.x + 30, y: s.y + 30 };
                            });
                            setShapes(prev => [...prev, ...newShapes]);
                        }
                        if (clipTexts?.length) {
                            const newTexts = clipTexts.map((t: FloatingText) => {
                                const newId = generateId();
                                newSelection.push({ type: 'text', id: newId });
                                return { ...t, id: newId, x: t.x + 30, y: t.y + 30 };
                            });
                            setTexts(prev => [...prev, ...newTexts]);
                        }
                        setSelection(newSelection);
                        addToHistory();
                    }
                } catch (err) { /* ignore */ }
            } else if (e.key === 'v' || e.key === 'V') {
                const tag = document.activeElement?.tagName.toLowerCase();
                if (tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) return;
                if (!e.metaKey && !e.ctrlKey) setTool("select");
            } else if (e.key === 't' || e.key === 'T') {
                const tag = document.activeElement?.tagName.toLowerCase();
                if (tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) return;
                if (!e.metaKey && !e.ctrlKey) setTool("text");
            } else if (e.key === ' ') {
                // Space to pan
                const tag = document.activeElement?.tagName.toLowerCase();
                if (tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) return;
                e.preventDefault();
                setIsPanning(true);
                setCanvasCursor("grab");
            } else if ((e.key === "Delete" || e.key === "Backspace") && (selectionRef.current?.length || 0) > 0) {
                // Ignore if we are typing in an input
                const tag = document.activeElement?.tagName.toLowerCase();
                if (tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) return;
                
                const safeSel = selectionRef.current || [];
                const shapeIds = new Set(safeSel.filter(s => s.type === "shape").map(s => s.id));
                const textIds = new Set(safeSel.filter(s => s.type === "text").map(s => s.id));
                const connIds = new Set(safeSel.filter(s => s.type === "connection").map(s => s.id));

                if (shapeIds.size > 0) {
                    setShapes(prev => prev.filter(s => !shapeIds.has(s.id)));
                    setConnections(prev => prev.filter(c => !shapeIds.has(c.fromId) && !shapeIds.has(c.toId)));
                }
                if (textIds.size > 0) {
                    setTexts(prev => prev.filter(t => !textIds.has(t.id)));
                }
                if (connIds.size > 0) {
                    setConnections(prev => prev.filter(c => !connIds.has(c.id)));
                }
                
                setSelection([]);
                addToHistory();
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === ' ') {
                setIsPanning(false);
                setCanvasCursor("default");
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [undo, redo, addToHistory]);

    // Canvas interactivity & Cursors
    useEffect(() => {
        if (tool === "delete") setCanvasCursor("not-allowed");
        else if (tool.startsWith("connect")) setCanvasCursor("crosshair");
        else if (tool === "select") setCanvasCursor(drawingConnection ? "crosshair" : isPanning ? "grabbing" : "default");
        else setCanvasCursor("crosshair"); // shape drawing tools
    }, [tool, drawingConnection, isPanning]);

    // Zoom with mouse wheel
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
                setTransform(prev => {
                    const newScale = Math.min(3, Math.max(0.25, prev.scale * zoomFactor));
                    // Zoom toward mouse position
                    const scaleChange = newScale / prev.scale;
                    const newX = mouseX - (mouseX - prev.x) * scaleChange;
                    const newY = mouseY - (mouseY - prev.y) * scaleChange;
                    return { x: newX, y: newY, scale: newScale };
                });
            } else {
                // Pan with scroll wheel (no modifier)
                setTransform(prev => ({
                    ...prev,
                    x: prev.x - e.deltaX,
                    y: prev.y - e.deltaY,
                }));
            }
        };
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, []);

    // Convert screen coordinates to canvas coordinates
    const screenToCanvas = useCallback((screenX: number, screenY: number) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return { x: screenX, y: screenY };
        const x = (screenX - rect.left - transform.x) / transform.scale;
        const y = (screenY - rect.top - transform.y) / transform.scale;
        return { x, y };
    }, [transform]);

    // Apply snap if enabled
    const applySnap = useCallback((value: number) => {
        return snapEnabled ? snapToGrid(value, GRID_SIZE) : value;
    }, [snapEnabled]);

    const getActiveLayerId = () => {
        return layers.find(l => l.id === activeLayerId) ? activeLayerId : layers[layers.length - 1]?.id;
    };

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        // Middle mouse button OR space key held = pan
        if (e.button === 1 || isPanning) {
            e.preventDefault();
            setIsPanning(true);
            panStartRef.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
            return;
        }

        const { x, y } = screenToCanvas(e.clientX, e.clientY);

        const targetLayerId = getActiveLayerId();
        const activeLayer = layers.find(l => l.id === targetLayerId);
        if (!targetLayerId || activeLayer?.locked || !activeLayer?.visible) {
            if (tool !== "select" && tool !== "delete") return;
        }

        if (tool.startsWith("shape_")) {
            const shapeType = tool.replace("shape_", "") as ShapeType;
            let w = 150;
            let h = 100;
            if (shapeType === 'actor') { w = 60; h = 100; }
            if (shapeType === 'class' || shapeType === 'interface' || shapeType === 'enum') { w = 200; h = 150; }
            if (shapeType === 'ellipse') { w = 120; h = 80; }
            if (shapeType === 'package') { w = 200; h = 160; }
            if (shapeType === 'note') { w = 140; h = 80; }
            
            const snappedX = applySnap(x);
            const snappedY = applySnap(y);
            
            const newShape: Shape = {
                id: generateId(),
                type: shapeType,
                x: snappedX, y: snappedY, w, h,
                text: shapeType === 'interface' ? "IInterface" : shapeType === 'enum' ? "EnumName" : shapeType === 'package' ? "package" : "New " + shapeType,
                details: (shapeType === 'class' || shapeType === 'interface') ? "+ property: type\n+ method(): void" : shapeType === 'enum' ? "VALUE_1\nVALUE_2\nVALUE_3" : "",
                stereotype: shapeType === 'interface' ? '<<interface>>' : shapeType === 'enum' ? '<<enumeration>>' : undefined,
                color: selectedColor,
                textColor: getContrastingColor(selectedColor),
                layerId: targetLayerId,
            };
            setShapes([...shapes, newShape]);
            drawingNewShapeRef.current = { id: newShape.id, startX: x, startY: y, dragged: false };
        } else if (tool === "text") {
            const newText: FloatingText = {
                id: generateId(),
                x: applySnap(x), y: applySnap(y),
                text: "New Text",
                color: selectedTextColor,
                layerId: targetLayerId,
            };
            setTexts([...texts, newText]);
            addToHistory();
            setTool("select");
        } else if (tool === "select") {
            // Start marquee selection on empty canvas area
            setSelection([]);
            setMarquee({ startX: x, startY: y, endX: x, endY: y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // Handle panning
        if (isPanning && panStartRef.current) {
            const dx = e.clientX - panStartRef.current.x;
            const dy = e.clientY - panStartRef.current.y;
            setTransform(prev => ({ ...prev, x: panStartRef.current!.tx + dx, y: panStartRef.current!.ty + dy }));
            return;
        }

        const { x, y } = screenToCanvas(e.clientX, e.clientY);

        // Handle marquee selection
        if (marquee && tool === "select" && !movingItemsRef.current.length && !resizingShapeRef.current) {
            setMarquee(prev => prev ? { ...prev, endX: x, endY: y } : null);
            return;
        }

        if (drawingConnection) {
            setDrawingConnection(prev => {
                if (!prev) return null;
                const newWaypoints = [...(prev.waypoints || [])];
                if (prev.type === "freeform") {
                    const lastIdx = newWaypoints.length - 1;
                    if (lastIdx < 0 || Math.hypot(x - newWaypoints[lastIdx].x, y - newWaypoints[lastIdx].y) > 10) {
                        newWaypoints.push({ x, y });
                    }
                }
                return { ...prev, currentX: x, currentY: y, waypoints: newWaypoints };
            });
        } else if (drawingNewShapeRef.current) {
            drawingNewShapeRef.current.dragged = true;
            const { id, startX, startY } = drawingNewShapeRef.current;
            const newW = Math.abs(x - startX);
            const newH = Math.abs(y - startY);
            const newX = Math.min(x, startX);
            const newY = Math.min(y, startY);
            
            setShapes(prev => prev.map(s => s.id === id ? { ...s, x: applySnap(newX), y: applySnap(newY), w: Math.max(20, newW), h: Math.max(20, newH) } : s));
        } else if (resizingShapeRef.current) {
            const { id, startX, startY, startW, startH } = resizingShapeRef.current;
            const dx = (e.clientX - startX) / transform.scale;
            const dy = (e.clientY - startY) / transform.scale;
            setShapes(prev => prev.map(s => s.id === id ? { ...s, w: Math.max(40, startW + dx), h: Math.max(40, startH + dy) } : s));
        } else if (moveStartRef.current && movingItemsRef.current.length > 0) {
            const dx = (e.clientX - moveStartRef.current.x) / transform.scale;
            const dy = (e.clientY - moveStartRef.current.y) / transform.scale;
            
            const shapeUpdates = new Map<string, {x:number, y:number}>();
            const textUpdates = new Map<string, {x:number, y:number}>();
            
            movingItemsRef.current.forEach(item => {
                const newX = snapEnabled ? applySnap(item.initX + dx) : item.initX + dx;
                const newY = snapEnabled ? applySnap(item.initY + dy) : item.initY + dy;
                if (item.type === 'shape') shapeUpdates.set(item.id, { x: newX, y: newY });
                if (item.type === 'text') textUpdates.set(item.id, { x: newX, y: newY });
            });
            
            if (shapeUpdates.size > 0) {
                setShapes(prev => prev.map(s => shapeUpdates.has(s.id) ? { ...s, ...shapeUpdates.get(s.id) } : s));
            }
            if (textUpdates.size > 0) {
                setTexts(prev => prev.map(t => textUpdates.has(t.id) ? { ...t, ...textUpdates.get(t.id) } : t));
            }
        }
    };

    const handleMouseUp = () => {
        // End panning (middle-click or space+drag)
        if (isPanning || panStartRef.current) {
            setIsPanning(false);
            panStartRef.current = null;
            // Don't return — fall through to clear other refs too
        }

        // Complete marquee selection
        if (marquee && tool === "select") {
            const minX = Math.min(marquee.startX, marquee.endX);
            const maxX = Math.max(marquee.startX, marquee.endX);
            const minY = Math.min(marquee.startY, marquee.endY);
            const maxY = Math.max(marquee.startY, marquee.endY);
            
            // Only select if marquee has meaningful size
            if (Math.abs(maxX - minX) > 5 || Math.abs(maxY - minY) > 5) {
                const selectedItems: SelectionItem[] = [];
                shapes.forEach(s => {
                    if (!getVisibilityFilter(s.layerId)) return;
                    // Select shapes that intersect the marquee (not just fully contained)
                    if (s.x < maxX && s.x + s.w > minX && s.y < maxY && s.y + s.h > minY) {
                        selectedItems.push({ type: "shape", id: s.id });
                    }
                });
                texts.forEach(t => {
                    if (!getVisibilityFilter(t.layerId)) return;
                    if (t.x >= minX && t.x <= maxX && t.y >= minY && t.y <= maxY) {
                        selectedItems.push({ type: "text", id: t.id });
                    }
                });
                if (selectedItems.length > 0) {
                    setSelection(selectedItems);
                }
            }
            setMarquee(null);
            return;
        }

        if (drawingConnection) {
            setDrawingConnection(null);
            setConnectionErrorTargetId(null);
        }
        if (drawingNewShapeRef.current) {
            addToHistory();
            setTool("select");
            drawingNewShapeRef.current = null;
        }
        if (resizingShapeRef.current || movingItemsRef.current.length > 0) {
            addToHistory();
        }
        resizingShapeRef.current = null;
        movingItemsRef.current = [];
        moveStartRef.current = null;
    };

    const handleShapeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const t = toolRef.current;
        const currentSelection = selectionRef.current;
        const shape = shapesRef.current.find(s => s.id === id);
        if (!shape) return;

        const shapeLayer = layers.find(l => l.id === shape.layerId);
        if (shapeLayer && (shapeLayer.locked || !shapeLayer.visible)) return; // Cannot interact with locked/hidden layer shapes

        if (t === "delete") {
            setShapes(prev => prev.filter(s => s.id !== id));
            setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id));
            setSelection(prev => prev.filter(s => !(s.type === 'shape' && s.id === id)));
            addToHistory();
            return;
        }

        if (t.startsWith("connect_")) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const defaults = getDefaultEndpoints(t);
            setDrawingConnection({
                fromId: id,
                fromLayerId: shape.layerId,
                currentX: (e.clientX - rect.left - transform.x) / transform.scale,
                currentY: (e.clientY - rect.top - transform.y) / transform.scale,
                type: defaults.connType,
                dashed: defaults.dashed,
                waypoints: []
            });
            return;
        }

        if (t === "scale") {
            setSelection([{ type: "shape", id }]);
            resizingShapeRef.current = {
                id,
                startX: e.clientX, startY: e.clientY,
                startW: shape.w, startH: shape.h,
            };
            return;
        }

        if (t !== "select") return;

        // Shift-click logic
        let newSelection = [...(currentSelection || [])];
        const isSelected = newSelection.some(s => s.type === "shape" && s.id === id);
        if (e.shiftKey) {
            if (isSelected) newSelection = newSelection.filter(s => !(s.type === "shape" && s.id === id));
            else newSelection.push({ type: "shape", id });
        } else {
            // Click outside selection entirely overrides it, click inside maintains it
            if (!isSelected) {
                newSelection = [{ type: "shape", id }];
            }
        }
        setSelection(newSelection);
        setActiveLayerId(shape.layerId);

        if ((e.target as HTMLElement).isContentEditable) {
            return;
        }

        // Initialize drag for ALL selected items (newSelection guarantees current is in there if not shift-clicked out)
        moveStartRef.current = { x: e.clientX, y: e.clientY };
        const itemsToMove: {id: string, type: "shape" | "text", initX: number, initY: number}[] = [];
        
        newSelection.forEach(sel => {
            if (sel.type === "shape") {
                const s = shapesRef.current.find(shape => shape.id === sel.id);
                if (s) itemsToMove.push({ id: s.id, type: "shape", initX: s.x, initY: s.y });
            } else if (sel.type === "text") {
                const t = textsRef.current.find(text => text.id === sel.id);
                if (t) itemsToMove.push({ id: t.id, type: "text", initX: t.x, initY: t.y });
            }
        });
        movingItemsRef.current = itemsToMove;

    }, [layers, addToHistory, transform]);

    const handleShapeMouseUp = useCallback((e: React.MouseEvent, id: string) => {
        if (drawingConnection && drawingConnection.fromId !== id) {
            const targetShape = shapes.find(s => s.id === id);
            if (!targetShape) return;

            // Enforce layer constraint
            if (targetShape.layerId !== drawingConnection.fromLayerId) {
                setConnectionErrorTargetId(id);
                setTimeout(() => setConnectionErrorTargetId(null), 500);
                setDrawingConnection(null);
                e.stopPropagation();
                return;
            }

            // Get endpoint defaults based on the tool type
            const defaults = getDefaultEndpoints(toolRef.current);

            const newConnection: Connection = {
                id: generateId(),
                fromId: drawingConnection.fromId,
                toId: id,
                color: selectedTextColor,
                dashed: drawingConnection.dashed || defaults.dashed,
                type: drawingConnection.type,
                waypoints: drawingConnection.waypoints,
                layerId: targetShape.layerId,
                sourceEndpoint: defaults.sourceEndpoint,
                targetEndpoint: defaults.targetEndpoint,
            };
            setConnections(prev => [...prev, newConnection]);
            setDrawingConnection(null);
            addToHistory();
            e.stopPropagation();
        }
    }, [drawingConnection, shapes, addToHistory, selectedTextColor, tool]);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (toolRef.current !== "select") return;

        const shape = shapesRef.current.find(s => s.id === id);
        if (!shape) return;
        resizingShapeRef.current = {
            id,
            startX: e.clientX, startY: e.clientY,
            startW: shape.w, startH: shape.h,
        };
    }, []);

    const handleShapeMouseEnter = useCallback((e: React.MouseEvent, id: string, hasText: boolean) => {
        if (toolRef.current === "select" && !drawingConnection) {
            setCanvasCursor("move");
        }
    }, [drawingConnection]);

    const handleShapeMouseLeave = useCallback((e: React.MouseEvent, id: string) => {
        if (toolRef.current === "select" && !drawingConnection) {
            setCanvasCursor("default");
        }
    }, [drawingConnection]);

    const handleConnectionClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (tool === "delete") {
            setConnections(prev => prev.filter(c => c.id !== id));
            setSelection(prev => prev.filter(s => !(s.type === 'connection' && s.id === id)));
            addToHistory();
            return;
        }
        if (tool !== "select") return;
        setSelection([{ type: "connection", id }]);
    };

    const updateShapeText = useCallback((id: string, text: string) => {
        setShapes(prev => prev.map(s => s.id === id ? { ...s, text } : s));
        addToHistory();
    }, [addToHistory]);

    const updateShapeDetails = useCallback((id: string, details: string) => {
        setShapes(prev => prev.map(s => s.id === id ? { ...s, details } : s));
        addToHistory();
    }, [addToHistory]);

    const handleSaveSnapshot = async (imgDataUrl?: string) => {
        const payload: ProjectSave = { version: "1.0", diagramType, shapes, connections, texts, layers };
        const entry = generateHistoryEntry(payload, `Snapshot ${new Date().toLocaleTimeString()}`, imgDataUrl);
        await saveHistoryEntry(entry);
    };

    const getThumbnailBase64 = async (): Promise<string | undefined> => {
        if (!canvasRef.current) return undefined;
        try {
            const oldSelection = selectionRef.current;
            setSelection([]);
            // Hide grids
            const bgElement = canvasRef.current.querySelector('.grid-bg-layer');
            if (bgElement) (bgElement as HTMLElement).style.opacity = '0';

            const canvas = await html2canvas(canvasRef.current, {
                backgroundColor: "#181818",
                scale: 1, // smaller scale for thumbnails
                ignoreElements: (element) => element.classList.contains('pointer-events-none') && element.tagName !== 'svg' && !element.tagName.startsWith('marker')
            });
            
            setSelection(oldSelection); // Restore
            if (bgElement) (bgElement as HTMLElement).style.opacity = '0.05';

            return canvas.toDataURL("image/png", 0.5); // lower quality for thumbnail
        } catch (error) {
            console.error("Failed to generate thumbnail:", error);
            return undefined;
        }
    };

    const exportAsPNG = async () => {
        if (!canvasRef.current) return;
        try {
            await new Promise(r => setTimeout(r, 100));
            const oldSelection = selectionRef.current;
            setSelection([]);
            
            const canvas = await html2canvas(canvasRef.current, {
                backgroundColor: "#181818",
                scale: 2,
                ignoreElements: (element) => element.classList.contains('pointer-events-none') && element.tagName !== 'svg' && !element.tagName.startsWith('marker')
            });
            
            setSelection(oldSelection);
            
            const imgData = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.download = "uml-diagram.png";
            link.href = imgData;
            link.click();

            // Auto-save history on export
            const thumbUrl = await getThumbnailBase64();
            await handleSaveSnapshot(thumbUrl || imgData);
            
        } catch (error) {
            console.error("Failed to export as PNG:", error);
        }
    };

    const handleExportProject = async () => {
        const payload: ProjectSave = { version: "1.0", diagramType, shapes, connections, texts, layers };
        exportProject(payload);
        
        // Auto-save history on export
        const thumbUrl = await getThumbnailBase64();
        await handleSaveSnapshot(thumbUrl);
    };

    const exportAsSVG = () => {
        if (!canvasRef.current) return;
        // Compute bounding box of all shapes
        if (shapes.length === 0) { alert("Nothing to export — add some shapes first."); return; }
        const padding = 40;
        const minX = Math.min(...shapes.map(s => s.x)) - padding;
        const minY = Math.min(...shapes.map(s => s.y)) - padding;
        const maxX = Math.max(...shapes.map(s => s.x + s.w)) + padding;
        const maxY = Math.max(...shapes.map(s => s.y + s.h)) + padding;
        const vw = maxX - minX;
        const vh = maxY - minY;

        const lines: string[] = [];
        lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${vw} ${vh}" width="${vw}" height="${vh}">`);
        lines.push(`<rect x="${minX}" y="${minY}" width="${vw}" height="${vh}" fill="#181818"/>`);

        // Shapes
        shapes.forEach(s => {
            if (!layers.find(l => l.id === s.layerId)?.visible) return;
            const fill = s.color || '#4b5563';
            const stroke = s.textColor || '#ffffff';
            switch (s.type) {
                case 'rectangle':
                case 'note':
                    lines.push(`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
                    lines.push(`<text x="${s.x + s.w/2}" y="${s.y + s.h/2 + 5}" text-anchor="middle" fill="${stroke}" font-size="13" font-family="sans-serif">${escSvg(s.text)}</text>`);
                    break;
                case 'ellipse':
                    lines.push(`<ellipse cx="${s.x + s.w/2}" cy="${s.y + s.h/2}" rx="${s.w/2}" ry="${s.h/2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
                    lines.push(`<text x="${s.x + s.w/2}" y="${s.y + s.h/2 + 5}" text-anchor="middle" fill="${stroke}" font-size="13" font-family="sans-serif">${escSvg(s.text)}</text>`);
                    break;
                case 'diamond': {
                    const cx = s.x + s.w/2, cy = s.y + s.h/2;
                    lines.push(`<polygon points="${cx},${s.y} ${s.x+s.w},${cy} ${cx},${s.y+s.h} ${s.x},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
                    lines.push(`<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="${stroke}" font-size="12" font-family="sans-serif">${escSvg(s.text)}</text>`);
                    break;
                }
                case 'class':
                case 'interface':
                case 'enum': {
                    lines.push(`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
                    const headerH = s.stereotype ? 36 : 26;
                    if (s.stereotype) lines.push(`<text x="${s.x + s.w/2}" y="${s.y + 14}" text-anchor="middle" fill="${stroke}" font-size="10" font-style="italic" font-family="sans-serif">${escSvg(s.stereotype)}</text>`);
                    lines.push(`<text x="${s.x + s.w/2}" y="${s.y + headerH - 6}" text-anchor="middle" fill="${stroke}" font-size="13" font-weight="bold" font-family="sans-serif">${escSvg(s.text)}</text>`);
                    lines.push(`<line x1="${s.x}" y1="${s.y + headerH}" x2="${s.x + s.w}" y2="${s.y + headerH}" stroke="${stroke}" stroke-width="1.5"/>`);
                    if (s.details) {
                        s.details.split('\n').forEach((line, i) => {
                            lines.push(`<text x="${s.x + 6}" y="${s.y + headerH + 16 + i * 14}" fill="${stroke}" font-size="11" font-family="monospace">${escSvg(line)}</text>`);
                        });
                    }
                    break;
                }
                case 'database': {
                    const rx = s.w/2, ry = s.h * 0.15;
                    const cx = s.x + rx, top = s.y, bot = s.y + s.h;
                    lines.push(`<path d="M ${s.x} ${top + ry} A ${rx} ${ry} 0 0 1 ${s.x+s.w} ${top + ry} L ${s.x+s.w} ${bot - ry} A ${rx} ${ry} 0 0 1 ${s.x} ${bot - ry} Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
                    lines.push(`<ellipse cx="${cx}" cy="${top + ry}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
                    lines.push(`<text x="${cx}" y="${top + s.h/2 + 5}" text-anchor="middle" fill="${stroke}" font-size="13" font-family="sans-serif">${escSvg(s.text)}</text>`);
                    break;
                }
                case 'actor': {
                    const cx = s.x + s.w/2;
                    const headR = Math.min(s.w, s.h) * 0.18;
                    const headY = s.y + headR + 4;
                    lines.push(`<circle cx="${cx}" cy="${headY}" r="${headR}" fill="none" stroke="${stroke}" stroke-width="2"/>`);
                    const bodyTop = headY + headR, bodyBot = s.y + s.h * 0.65;
                    lines.push(`<line x1="${cx}" y1="${bodyTop}" x2="${cx}" y2="${bodyBot}" stroke="${stroke}" stroke-width="2"/>`);
                    lines.push(`<line x1="${s.x + 4}" y1="${bodyTop + (bodyBot-bodyTop)*0.3}" x2="${s.x+s.w-4}" y2="${bodyTop + (bodyBot-bodyTop)*0.3}" stroke="${stroke}" stroke-width="2"/>`);
                    lines.push(`<line x1="${cx}" y1="${bodyBot}" x2="${s.x+4}" y2="${s.y+s.h-4}" stroke="${stroke}" stroke-width="2"/>`);
                    lines.push(`<line x1="${cx}" y1="${bodyBot}" x2="${s.x+s.w-4}" y2="${s.y+s.h-4}" stroke="${stroke}" stroke-width="2"/>`);
                    lines.push(`<text x="${cx}" y="${s.y+s.h+14}" text-anchor="middle" fill="${stroke}" font-size="12" font-family="sans-serif">${escSvg(s.text)}</text>`);
                    break;
                }
                case 'package': {
                    const tabW = s.w * 0.35, tabH = 22;
                    lines.push(`<rect x="${s.x}" y="${s.y}" width="${tabW}" height="${tabH}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
                    lines.push(`<rect x="${s.x}" y="${s.y + tabH}" width="${s.w}" height="${s.h - tabH}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
                    lines.push(`<text x="${s.x + s.w/2}" y="${s.y + tabH + 20}" text-anchor="middle" fill="${stroke}" font-size="13" font-weight="bold" font-family="sans-serif">${escSvg(s.text)}</text>`);
                    break;
                }
            }
        });

        // Connections
        connections.forEach(conn => {
            const from = shapes.find(s => s.id === conn.fromId);
            const to = shapes.find(s => s.id === conn.toId);
            if (!from || !to) return;
            const { path, p1, p2 } = calculatePath(from, to, conn.type, conn.waypoints);
            const color = conn.color || '#ffffff';
            const dash = conn.dashed ? 'stroke-dasharray="6,6"' : '';
            const markerId = `m-${conn.id}`;
            // Simple arrowhead marker
            lines.push(`<defs><marker id="${markerId}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${color}"/></marker></defs>`);
            lines.push(`<path d="${path}" stroke="${color}" stroke-width="2" fill="none" ${dash} marker-end="url(#${markerId})"/>`);
            if (conn.label) lines.push(`<text x="${(p1.x+p2.x)/2}" y="${(p1.y+p2.y)/2 - 6}" text-anchor="middle" fill="${color}" font-size="11" font-family="sans-serif">${escSvg(conn.label)}</text>`);
            if (conn.sourceLabel) lines.push(`<text x="${p1.x+8}" y="${p1.y-6}" fill="${color}" font-size="10" font-family="sans-serif">${escSvg(conn.sourceLabel)}</text>`);
            if (conn.targetLabel) lines.push(`<text x="${p2.x-8}" y="${p2.y-6}" text-anchor="end" fill="${color}" font-size="10" font-family="sans-serif">${escSvg(conn.targetLabel)}</text>`);
        });

        // Floating texts
        texts.forEach(t => {
            if (!layers.find(l => l.id === t.layerId)?.visible) return;
            lines.push(`<text x="${t.x}" y="${t.y}" fill="${t.color || '#ffffff'}" font-size="14" font-family="sans-serif">${escSvg(t.text)}</text>`);
        });

        lines.push('</svg>');
        const svgBlob = new Blob([lines.join('\n')], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);
        const a = document.createElement('a');
        a.href = url; a.download = 'uml-diagram.svg'; a.click();
        URL.revokeObjectURL(url);
    };


    const handleImportProjectClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const loadProjectData = (data: ProjectSave) => {
        setDiagramType(data.diagramType || "general");
        setShapes(data.shapes || []);
        setConnections(data.connections || []);
        setTexts(data.texts || []);
        setLayers(data.layers || [DEFAULT_LAYER]);
        setSelection([]);
        setTool("select");
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const data = await importProject(file);
            loadProjectData(data);
            e.target.value = '';
        } catch (error) {
            console.error("Failed to import file", error);
            alert("Failed to load project file. It might be corrupted.");
        }
    };

    // Translator Import
    const handleTranslatorImport = (newShapes: Shape[], newConns: Connection[], newTexts: FloatingText[], newLayers: Layer[]) => {
        setShapes(newShapes);
        setConnections(newConns);
        setTexts(newTexts);
        setLayers(newLayers);
        if (newLayers.length > 0) setActiveLayerId(newLayers[newLayers.length - 1].id);
        setSelection([]);
        addToHistory();
    };

    // Layer Handlers
    const handleAddLayer = () => {
        const newLayer: Layer = { id: generateId(), name: `Layer ${layers.length + 1}`, visible: true, locked: false };
        setLayers(prev => [...prev, newLayer]);
        setActiveLayerId(newLayer.id);
        addToHistory();
    };
    const handleDeleteLayer = (id: string) => {
        if (layers.length <= 1) return; // Need at least one layer
        // Compute which shape IDs belong to this layer before removing them
        const deletedShapeIds = new Set(shapes.filter(s => s.layerId === id).map(s => s.id));
        setLayers(prev => prev.filter(l => l.id !== id));
        setShapes(prev => prev.filter(s => s.layerId !== id));
        setTexts(prev => prev.filter(t => t.layerId !== id));
        setConnections(prev => prev.filter(c => !deletedShapeIds.has(c.fromId) && !deletedShapeIds.has(c.toId)));
        if (activeLayerId === id) setActiveLayerId(layers.filter(l => l.id !== id)[0].id);
        addToHistory();
    };
    const handleRenameLayer = (id: string, name: string) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, name } : l));
        addToHistory();
    };
    const handleToggleLayerLock = (id: string) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, locked: !l.locked } : l));
        addToHistory();
    };
    const handleToggleLayerVisibility = (id: string) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
        setSelection([]);
        addToHistory();
    };

    // Element specific actions from Sidebar
    const handleDeleteElement = (id: string, type: 'shape' | 'text') => {
        if (type === 'shape') {
            setShapes(prev => prev.filter(s => s.id !== id));
            setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id));
        } else if (type === 'text') {
            setTexts(prev => prev.filter(t => t.id !== id));
        }
        setSelection(prev => prev.filter(s => !(s.type === type && s.id === id)));
        addToHistory();
    };
    const handleRenameElement = (id: string, type: 'shape' | 'text', newText: string) => {
        if (type === 'shape') {
            setShapes(prev => prev.map(s => s.id === id ? { ...s, text: newText } : s));
        } else if (type === 'text') {
            setTexts(prev => prev.map(t => t.id === id ? { ...t, text: newText } : t));
        }
        addToHistory();
    };

    const getVisibilityFilter = (layerId: string) => layers.find(l => l.id === layerId)?.visible ?? false;
    const getLayerZIndex = (layerId: string) => layers.findIndex(l => l.id === layerId) * 100;

    return (
        <div className="min-h-screen bg-[#121212] text-white flex flex-col font-sans">
            <header className="h-16 border-b border-gray-700 flex items-center justify-between px-4 bg-[#1e1e1e] z-[10000] relative">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold tracking-wider flex items-center gap-2">
                        <MonitorPlay size={20} className="text-blue-400" />
                        UML Maker
                    </h1>
                    <select 
                        value={diagramType} 
                        onChange={(e) => {
                            setDiagramType(e.target.value as DiagramType);
                            setTool("select");
                        }}
                        className="bg-[#2a2a2a] border border-gray-600 rounded px-2 py-1 text-sm outline-none focus:border-blue-500 transition-colors"
                    >
                        <option value="general">General</option>
                        <option value="flowchart">Flowchart</option>
                        <option value="class">Class Diagram</option>
                        <option value="usecase">Use Case</option>
                    </select>
                    <Link href="/games" className="text-sm text-gray-400 hover:text-white transition-colors ml-4">
                        ← Back
                    </Link>
                </div>

                <input type="file" accept=".scmu,.json" ref={fileInputRef} onChange={handleFileImport} className="hidden" />

                <CanvasToolbar 
                    diagramType={diagramType} 
                    tool={tool} 
                    setTool={setTool} 
                    onExportPng={exportAsPNG} 
                    onExportProject={handleExportProject}
                    onExportSvg={exportAsSVG}
                    onImportProject={handleImportProjectClick}
                    onToggleLayers={() => setLayersPanelOpen(!layersPanelOpen)}
                    onOpenTranslator={() => setTranslatorOpen(true)}
                    onOpenHistory={() => setHistoryOpen(true)}
                    layersPanelOpen={layersPanelOpen}
                    snapEnabled={snapEnabled}
                    onToggleSnap={() => setSnapEnabled(!snapEnabled)}
                />

                {/* Color pickers */}
                <div className="flex items-center gap-4 bg-[#2a2a2a] p-1.5 rounded-lg">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-medium uppercase min-w-[30px] hidden md:block">Fill:</span>
                        <div className="flex gap-1 bg-[#1e1e1e] p-1 rounded-md">
                            {COLORS.slice(0, 5).map(c => (
                                <button
                                    key={c}
                                    className={`w-5 h-5 rounded-full border border-gray-600 transition-transform ${selectedColor === c ? "ring-2 ring-blue-500 scale-110" : "hover:scale-110"}`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => {
                                        setSelectedColor(c);
                                        const safeSel = selection || [];
                                        const shapeIds = new Set(safeSel.filter(s => s.type === 'shape').map(s => s.id));
                                        if (shapeIds.size > 0) {
                                            setShapes(prev => prev.map(b => shapeIds.has(b.id) ? { ...b, color: c } : b));
                                            addToHistory();
                                        }
                                    }}
                                />
                            ))}
                            <input
                                type="color"
                                value={selectedColor}
                                onChange={(e) => {
                                    setSelectedColor(e.target.value);
                                    const safeSel = selection || [];
                                    const shapeIds = new Set(safeSel.filter(s => s.type === 'shape').map(s => s.id));
                                    if (shapeIds.size > 0) {
                                        setShapes(prev => prev.map(b => shapeIds.has(b.id) ? { ...b, color: e.target.value } : b));
                                        addToHistory();
                                    }
                                }}
                                className="w-5 h-5 p-0 border-0 rounded cursor-pointer ml-1"
                            />
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Layers Panel */}
                <LayersPanel
                    isOpen={layersPanelOpen}
                    onToggle={() => setLayersPanelOpen(!layersPanelOpen)}
                    layers={layers}
                    shapes={shapes}
                    texts={texts}
                    activeLayerId={activeLayerId}
                    selection={selection}
                    onSetActiveLayer={setActiveLayerId}
                    onToggleVisibility={handleToggleLayerVisibility}
                    onToggleLock={handleToggleLayerLock}
                    onAddLayer={handleAddLayer}
                    onDeleteLayer={handleDeleteLayer}
                    onRenameLayer={handleRenameLayer}
                    onReorderLayers={(newLayers) => { setLayers(newLayers); addToHistory(); }}
                    onSelectElement={(id, type, shiftKey) => {
                        let newSelection = [...(selection || [])];
                        const isSelected = newSelection.some(s => s.type === type && s.id === id);
                        if (shiftKey) {
                            if (isSelected) newSelection = newSelection.filter(s => !(s.type === type && s.id === id));
                            else newSelection.push({ type, id });
                        } else {
                            newSelection = [{ type, id }];
                        }
                        setSelection(newSelection);
                    }}
                    onMoveElementToLayer={(id, type, targetLayerId) => {
                        if (type === 'shape') {
                            setShapes(prev => prev.map(s => s.id === id ? { ...s, layerId: targetLayerId } : s));
                        } else {
                            setTexts(prev => prev.map(t => t.id === id ? { ...t, layerId: targetLayerId } : t));
                        }
                        addToHistory();
                    }}
                    onDeleteElement={handleDeleteElement}
                    onRenameElement={handleRenameElement}
                />

                {/* Main Canvas */}
                <div
                    ref={canvasRef}
                    className="flex-1 relative overflow-hidden bg-[#181818]"
                    style={{ cursor: canvasCursor }}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Transformed content layer */}
                    <div
                        className="absolute inset-0 origin-top-left"
                        style={{
                            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                            willChange: 'transform',
                        }}
                    >
                    <div
                        className="grid-bg-layer absolute inset-0 pointer-events-none opacity-5 transition-opacity duration-200"
                        style={{
                            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                            width: '10000px',
                            height: '10000px',
                            left: '-5000px',
                            top: '-5000px',
                        }}
                    />

                    {/* Shapes and Texts */}
                    {shapes.map(shape => {
                        const isVisible = getVisibilityFilter(shape.layerId);
                        const shapeLayer = layers.find(l => l.id === shape.layerId);
                        const isSel = (selection || []).some(s => s.type === "shape" && s.id === shape.id);
                        const isError = connectionErrorTargetId === shape.id;
                        return (
                            <div key={shape.id} className={isError ? "ring-4 ring-red-500/80 transition-shadow animate-pulse rounded-lg" : ""}>
                                <ShapeRenderer
                                    shape={shape}
                                    isSelected={isSel}
                                    tool={tool}
                                    isVisible={isVisible}
                                    isLocked={shapeLayer?.locked ?? false}
                                    onMouseDown={handleShapeMouseDown}
                                    onMouseUp={handleShapeMouseUp}
                                    onResizeMouseDown={handleResizeMouseDown}
                                    onMouseEnter={handleShapeMouseEnter}
                                    onMouseLeave={handleShapeMouseLeave}
                                    updateShapeText={updateShapeText}
                                    updateShapeDetails={updateShapeDetails}
                                    zIndex={getLayerZIndex(shape.layerId) + (isSel ? 10 : 0)}
                                />
                            </div>
                        );
                    })}

                    {texts.map(text => {
                        const isVisible = getVisibilityFilter(text.layerId);
                        if (!isVisible) return null;
                        const isSel = (selection || []).some(s => s.type === "text" && s.id === text.id);
                        const tLayer = layers.find(l => l.id === text.layerId);
                        const isLocked = tLayer?.locked;

                        return (
                            <div
                                key={text.id}
                                className={`absolute p-1 select-none ${isSel ? "ring-1 ring-blue-500 border-dashed border border-blue-500 bg-blue-500 bg-opacity-10 z-[8000]" : ""} ${tool === "delete" ? "hover:bg-red-500 hover:bg-opacity-20 cursor-pointer" : tool === "select" && !isLocked ? "cursor-move" : ""}`}
                                style={{
                                    left: text.x, top: text.y,
                                    color: text.color, zIndex: getLayerZIndex(text.layerId) + 5
                                }}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if (isLocked) return;
                                    if (tool === "delete") {
                                        setTexts(prev => prev.filter(t => t.id !== text.id));
                                        setSelection(prev => prev.filter(s => !(s.type === 'text' && s.id === text.id)));
                                        addToHistory();
                                        return;
                                    }
                                    if (tool !== "select") return;
                                    
                                    let newSelection = [...(selection || [])];
                                    if (e.shiftKey) {
                                        if (isSel) newSelection = newSelection.filter(s => !(s.type === 'text' && s.id === text.id));
                                        else newSelection.push({ type: 'text', id: text.id });
                                    } else {
                                        if (!isSel) newSelection = [{ type: 'text', id: text.id }];
                                    }
                                    setSelection(newSelection);
                                    setActiveLayerId(text.layerId);
                                    
                                    if ((e.target as HTMLElement).tagName.toLowerCase() === 'input') {
                                        return;
                                    }
                                    
                                    moveStartRef.current = { x: e.clientX, y: e.clientY };
                                    const itemsToMove: {id: string, type: "shape"| "text", initX: number, initY: number}[] = [];
                                    newSelection.forEach(sel => {
                                        if (sel.type === "shape") {
                                            const s = shapes.find(shape => shape.id === sel.id);
                                            if (s) itemsToMove.push({ id: s.id, type: "shape", initX: s.x, initY: s.y });
                                        } else if (sel.type === "text") {
                                            const t = texts.find(tx => tx.id === sel.id);
                                            if (t) itemsToMove.push({ id: t.id, type: "text", initX: t.x, initY: t.y });
                                        }
                                    });
                                    movingItemsRef.current = itemsToMove;
                                }}
                                onMouseEnter={() => { if(tool === "select" && !isLocked) setCanvasCursor("move"); }}
                                onMouseLeave={() => { if(tool === "select" && !isLocked) setCanvasCursor("default"); }}
                            >
                                <span className={isLocked ? "" : "cursor-text"} onMouseEnter={(e) => { if(tool==="select" && !isLocked) { e.stopPropagation(); setCanvasCursor("text"); } }}>
                                    <input
                                        type="text"
                                        className={`bg-transparent border-none outline-none font-medium ${tool === "delete" || isLocked ? "pointer-events-none" : ""}`}
                                        value={text.text}
                                        onChange={(e) => setTexts(prev => prev.map(t => t.id === text.id ? { ...t, text: e.target.value } : t))}
                                        onBlur={() => addToHistory()}
                                        style={{ color: text.color, minWidth: "50px" }}
                                        readOnly={tool === "delete" || isLocked}
                                    />
                                </span>
                            </div>
                        );
                    })}

                    {/* SVG Connections (ALWAYS ON TOP) */}
                    <svg className="absolute pointer-events-none" style={{ zIndex: 9000, left: 0, top: 0, width: '10000px', height: '10000px', overflow: 'visible' }}>
                        <defs dangerouslySetInnerHTML={{ __html: connections.map(conn => {
                            const isSelected = (selection || []).some(s => s.type === "connection" && s.id === conn.id);
                            const color = isSelected ? "#60A5FA" : (conn.color || "#ffffff");
                            const targetEp = conn.targetEndpoint || "arrow";
                            const sourceEp = conn.sourceEndpoint || "none";
                            let markers = '';
                            if (targetEp !== "none") markers += getEndpointMarkerSVG(targetEp, color, `marker-target-${conn.id}`, false);
                            if (sourceEp !== "none") markers += getEndpointMarkerSVG(sourceEp, color, `marker-source-${conn.id}`, true);
                            return markers;
                        }).join('') + getEndpointMarkerSVG("arrow", selectedTextColor || "#ffffff", "arrowhead-drawing", false) }} />
                        
                        {connections.map(conn => {
                            const fromShape = shapes.find(s => s.id === conn.fromId);
                            const toShape = shapes.find(s => s.id === conn.toId);
                            if (!fromShape || !toShape) return null;

                            const isVisible = getVisibilityFilter(conn.layerId || fromShape.layerId);
                            if (!isVisible) return null;

                            const { path, p1, p2, angle } = calculatePath(fromShape, toShape, conn.type, conn.waypoints);
                            const isSelected = (selection || []).some(s => s.type === "connection" && s.id === conn.id);
                            const targetEp = conn.targetEndpoint || "arrow";
                            const sourceEp = conn.sourceEndpoint || "none";

                            return (
                                <g key={conn.id} className="pointer-events-auto" onClick={(e) => handleConnectionClick(e, conn.id)}>
                                    {/* Hit area */}
                                    <path d={path} stroke="transparent" strokeWidth="15" fill="none" className={tool === "delete" || tool === "select" ? "cursor-pointer" : ""} />
                                    {/* Visible line */}
                                    <path
                                        d={path}
                                        stroke={isSelected ? "#60A5FA" : (conn.color || "#ffffff")}
                                        strokeWidth="2.5"
                                        fill="none"
                                        strokeDasharray={conn.dashed ? "6,6" : "none"}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        markerEnd={targetEp !== "none" ? `url(#marker-target-${conn.id})` : undefined}
                                        markerStart={sourceEp !== "none" ? `url(#marker-source-${conn.id})` : undefined}
                                        className={`transition-all ${isSelected ? "drop-shadow-[0_0_8px_rgba(59,130,246,0.9)]" : ""} ${tool === "delete" ? "hover:stroke-red-500 cursor-pointer" : ""}`}
                                    />
                                    {/* Connection label */}
                                    {conn.label && (
                                        <text
                                            x={(p1.x + p2.x) / 2}
                                            y={(p1.y + p2.y) / 2 - 8}
                                            textAnchor="middle"
                                            fill={isSelected ? "#60A5FA" : (conn.color || "#ffffff")}
                                            fontSize="11"
                                            className="pointer-events-none select-none"
                                        >{conn.label}</text>
                                    )}
                                    {/* Source multiplicity label */}
                                    {conn.sourceLabel && (
                                        <text
                                            x={p1.x + 10}
                                            y={p1.y - 8}
                                            textAnchor="start"
                                            fill={conn.color || "#ffffff"}
                                            fontSize="10"
                                            className="pointer-events-none select-none"
                                        >{conn.sourceLabel}</text>
                                    )}
                                    {/* Target multiplicity label */}
                                    {conn.targetLabel && (
                                        <text
                                            x={p2.x - 10}
                                            y={p2.y - 8}
                                            textAnchor="end"
                                            fill={conn.color || "#ffffff"}
                                            fontSize="10"
                                            className="pointer-events-none select-none"
                                        >{conn.targetLabel}</text>
                                    )}
                                </g>
                            );
                        })}

                        {drawingConnection && (() => {
                            const fromShape = shapes.find(s => s.id === drawingConnection.fromId);
                            if (!fromShape) return null;
                            const { path, p2, angle } = calculatePath(fromShape, { x: drawingConnection.currentX, y: drawingConnection.currentY, w:0, h:0 }, drawingConnection.type, drawingConnection.waypoints);
                            
                            return (
                                <g>
                                    <path
                                        d={path}
                                        stroke={selectedTextColor || "#ffffff"}
                                        strokeWidth="2.5"
                                        fill="none"
                                        strokeDasharray="4,4"
                                        markerEnd="url(#arrowhead-drawing)"
                                        className="opacity-70"
                                    />
                                </g>
                            );
                        })()}
                    </svg>

                    </div>{/* End transform wrapper */}

                    {/* FloatingQuickEditMenu — rendered in screen space, outside the transform wrapper */}
                    <FloatingQuickEditMenu
                        selection={selection}
                        tool={tool}
                        shapes={shapes}
                        setShapes={setShapes}
                        texts={texts}
                        setTexts={setTexts}
                        connections={connections}
                        setConnections={setConnections}
                        layers={layers}
                        setSelection={setSelection}
                        addToHistory={addToHistory}
                        generateId={generateId}
                        transform={transform}
                    />

                    {/* Marquee selection rectangle (in screen space) */}
                    {marquee && (
                        <div
                            className="absolute border-2 border-blue-400 bg-blue-400/10 pointer-events-none z-[9999]"
                            style={{
                                left: Math.min(marquee.startX, marquee.endX) * transform.scale + transform.x,
                                top: Math.min(marquee.startY, marquee.endY) * transform.scale + transform.y,
                                width: Math.abs(marquee.endX - marquee.startX) * transform.scale,
                                height: Math.abs(marquee.endY - marquee.startY) * transform.scale,
                            }}
                        />
                    )}

                    {/* Zoom indicator */}
                    <div className="absolute bottom-3 right-3 bg-[#2a2a2a] border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 font-mono z-[9999] select-none flex items-center gap-2">
                        <button onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.25, prev.scale - 0.1) }))} className="hover:text-white">−</button>
                        <span>{Math.round(transform.scale * 100)}%</span>
                        <button onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale + 0.1) }))} className="hover:text-white">+</button>
                        <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} className="ml-1 hover:text-white text-gray-500" title="Reset view">⌂</button>
                    </div>
                </div>
            </div>

            <DiagramTranslatorModal
                isOpen={translatorOpen}
                onClose={() => setTranslatorOpen(false)}
                shapes={shapes}
                connections={connections}
                texts={texts}
                layers={layers}
                diagramType={diagramType}
                onImport={handleTranslatorImport}
            />

            <ProjectHistoryModal
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                onLoadEntry={loadProjectData}
            />
        </div>
    );
};

export default SchemaDrawerPage;
