import React, { useState } from 'react';
import { Type, PaintBucket, ArrowUpToLine, ArrowDownToLine, Copy, Trash2, AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, Tag } from "lucide-react";
import { Shape, FloatingText, Connection, Tool, Layer, CanvasTransform } from '../types';

interface FloatingQuickEditMenuProps {
    selection: { type: "shape" | "text" | "connection"; id: string }[];
    tool: Tool;
    shapes: Shape[];
    setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
    texts: FloatingText[];
    setTexts: React.Dispatch<React.SetStateAction<FloatingText[]>>;
    connections: Connection[];
    setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
    layers: Layer[];
    setSelection: (sel: { type: "shape" | "text" | "connection"; id: string }[]) => void;
    addToHistory: () => void;
    generateId: () => string;
    transform: CanvasTransform;
}

export const FloatingQuickEditMenu: React.FC<FloatingQuickEditMenuProps> = ({
    selection, tool, shapes, setShapes, texts, setTexts, connections, setConnections, layers,
    setSelection, addToHistory, generateId, transform
}) => {
    const [showLabelEditor, setShowLabelEditor] = useState(false);
    const [labelValue, setLabelValue] = useState('');
    const [sourceLabelValue, setSourceLabelValue] = useState('');
    const [targetLabelValue, setTargetLabelValue] = useState('');

    if (!selection || !Array.isArray(selection) || selection.length === 0 || tool === "delete" || tool.startsWith("connect") || tool === "scale") return null;

    const firstSel = selection[0];
    let targetCanvasX = 0, targetCanvasY = 0;

    const hasShapes = selection.some(s => s.type === "shape");
    const hasTexts = selection.some(s => s.type === "text" || s.type === "shape");
    const isConnectionOnly = selection.length === 1 && firstSel.type === "connection";
    const selectedShapes = shapes.filter(s => selection.some(sel => sel.type === "shape" && sel.id === s.id));
    const multipleShapes = selectedShapes.length >= 2;

    if (firstSel.type === "shape") {
        const s = shapes.find(s => s.id === firstSel.id);
        if (s) { targetCanvasX = s.x; targetCanvasY = s.y; }
        else return null;
    } else if (firstSel.type === "text") {
        const t = texts.find(t => t.id === firstSel.id);
        if (t) { targetCanvasX = t.x; targetCanvasY = t.y; }
        else return null;
    } else if (firstSel.type === "connection") {
        // Position near the midpoint of the connection
        const conn = connections.find(c => c.id === firstSel.id);
        if (!conn) return null;
        const fromShape = shapes.find(s => s.id === conn.fromId);
        const toShape = shapes.find(s => s.id === conn.toId);
        if (fromShape && toShape) {
            targetCanvasX = (fromShape.x + fromShape.w / 2 + toShape.x + toShape.w / 2) / 2;
            targetCanvasY = Math.min(fromShape.y, toShape.y) - 10;
        } else return null;
    } else {
        return null;
    }

    // Convert canvas-space coordinates to screen-space
    const screenX = targetCanvasX * transform.scale + transform.x;
    const screenY = targetCanvasY * transform.scale + transform.y;

    const bringToFront = () => {
        const topLayer = layers[layers.length - 1];
        if (!topLayer) return;
        const shapeIds = new Set(selection.filter(s => s.type === 'shape').map(s => s.id));
        const textIds = new Set(selection.filter(s => s.type === 'text').map(s => s.id));
        if (shapeIds.size > 0) {
            setShapes(prev => {
                const toMove = prev.filter(s => shapeIds.has(s.id)).map(s => ({ ...s, layerId: topLayer.id }));
                const remaining = prev.filter(s => !shapeIds.has(s.id));
                return [...remaining, ...toMove];
            });
        }
        if (textIds.size > 0) {
            setTexts(prev => {
                const toMove = prev.filter(t => textIds.has(t.id)).map(t => ({ ...t, layerId: topLayer.id }));
                const remaining = prev.filter(t => !textIds.has(t.id));
                return [...remaining, ...toMove];
            });
        }
        if (shapeIds.size > 0 || textIds.size > 0) addToHistory();
    };

    const sendToBack = () => {
        const bottomLayer = layers[0];
        if (!bottomLayer) return;
        const shapeIds = new Set(selection.filter(s => s.type === 'shape').map(s => s.id));
        const textIds = new Set(selection.filter(s => s.type === 'text').map(s => s.id));
        if (shapeIds.size > 0) {
            setShapes(prev => {
                const toMove = prev.filter(s => shapeIds.has(s.id)).map(s => ({ ...s, layerId: bottomLayer.id }));
                const remaining = prev.filter(s => !shapeIds.has(s.id));
                return [...toMove, ...remaining];
            });
        }
        if (textIds.size > 0) {
            setTexts(prev => {
                const toMove = prev.filter(t => textIds.has(t.id)).map(t => ({ ...t, layerId: bottomLayer.id }));
                const remaining = prev.filter(t => !textIds.has(t.id));
                return [...toMove, ...remaining];
            });
        }
        if (shapeIds.size > 0 || textIds.size > 0) addToHistory();
    };

    const duplicate = () => {
        const newSelection: { type: "shape" | "text", id: string }[] = [];
        if (hasShapes) {
            const shapeIds = new Set(selection.filter(s => s.type === 'shape').map(s => s.id));
            const toCopy = shapes.filter(s => shapeIds.has(s.id));
            const duplicates = toCopy.map(s => {
                const newId = generateId();
                newSelection.push({ type: 'shape', id: newId });
                return { ...s, id: newId, x: s.x + 20, y: s.y + 20 };
            });
            setShapes(prev => [...prev, ...duplicates]);
        }
        if (selection.some(s => s.type === "text")) {
            const textIds = new Set(selection.filter(s => s.type === 'text').map(s => s.id));
            const toCopy = texts.filter(t => textIds.has(t.id));
            const duplicates = toCopy.map(t => {
                const newId = generateId();
                newSelection.push({ type: 'text', id: newId });
                return { ...t, id: newId, x: t.x + 20, y: t.y + 20 };
            });
            setTexts(prev => [...prev, ...duplicates]);
        }
        if (newSelection.length > 0) { setSelection(newSelection); addToHistory(); }
    };

    const deleteSelection = () => {
        const shapeIds = new Set(selection.filter(s => s.type === 'shape').map(s => s.id));
        const textIds = new Set(selection.filter(s => s.type === 'text').map(s => s.id));
        const connIds = new Set(selection.filter(s => s.type === 'connection').map(s => s.id));
        if (shapeIds.size > 0) {
            setShapes(prev => prev.filter(s => !shapeIds.has(s.id)));
            setConnections(prev => prev.filter(c => !shapeIds.has(c.fromId) && !shapeIds.has(c.toId)));
        }
        if (textIds.size > 0) setTexts(prev => prev.filter(t => !textIds.has(t.id)));
        if (connIds.size > 0) setConnections(prev => prev.filter(c => !connIds.has(c.id)));
        setSelection([]);
        addToHistory();
    };

    // Alignment helpers
    const alignShapes = (axis: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => {
        if (selectedShapes.length < 2) return;
        const xs = selectedShapes.map(s => s.x);
        const ys = selectedShapes.map(s => s.y);
        const rights = selectedShapes.map(s => s.x + s.w);
        const bottoms = selectedShapes.map(s => s.y + s.h);
        const minX = Math.min(...xs), maxRight = Math.max(...rights);
        const minY = Math.min(...ys), maxBottom = Math.max(...bottoms);
        const ids = new Set(selectedShapes.map(s => s.id));
        setShapes(prev => prev.map(s => {
            if (!ids.has(s.id)) return s;
            switch (axis) {
                case 'left':    return { ...s, x: minX };
                case 'center-h': return { ...s, x: (minX + maxRight) / 2 - s.w / 2 };
                case 'right':   return { ...s, x: maxRight - s.w };
                case 'top':     return { ...s, y: minY };
                case 'center-v': return { ...s, y: (minY + maxBottom) / 2 - s.h / 2 };
                case 'bottom':  return { ...s, y: maxBottom - s.h };
                default: return s;
            }
        }));
        addToHistory();
    };

    const distributeShapes = (dir: 'h' | 'v') => {
        if (selectedShapes.length < 3) return;
        const sorted = [...selectedShapes].sort((a, b) => dir === 'h' ? a.x - b.x : a.y - b.y);
        const first = sorted[0], last = sorted[sorted.length - 1];
        const totalSpan = dir === 'h'
            ? (last.x + last.w) - first.x
            : (last.y + last.h) - first.y;
        const totalSize = sorted.reduce((sum, s) => sum + (dir === 'h' ? s.w : s.h), 0);
        const gap = (totalSpan - totalSize) / (sorted.length - 1);
        let cursor = dir === 'h' ? first.x + first.w + gap : first.y + first.h + gap;
        const updates = new Map<string, { x?: number; y?: number }>();
        for (let i = 1; i < sorted.length - 1; i++) {
            updates.set(sorted[i].id, dir === 'h' ? { x: cursor } : { y: cursor });
            cursor += (dir === 'h' ? sorted[i].w : sorted[i].h) + gap;
        }
        setShapes(prev => prev.map(s => updates.has(s.id) ? { ...s, ...updates.get(s.id) } : s));
        addToHistory();
    };

    // Connection label editing
    const openLabelEditor = () => {
        const conn = connections.find(c => c.id === firstSel.id);
        if (!conn) return;
        setLabelValue(conn.label || '');
        setSourceLabelValue(conn.sourceLabel || '');
        setTargetLabelValue(conn.targetLabel || '');
        setShowLabelEditor(true);
    };

    const saveLabelEdit = () => {
        setConnections(prev => prev.map(c => c.id === firstSel.id
            ? { ...c, label: labelValue.trim() || undefined, sourceLabel: sourceLabelValue.trim() || undefined, targetLabel: targetLabelValue.trim() || undefined }
            : c
        ));
        addToHistory();
        setShowLabelEditor(false);
    };

    const anchorShape = firstSel.type === "shape" ? shapes.find(s => s.id === firstSel.id) : null;
    const anchorText = firstSel.type === "text" ? texts.find(t => t.id === firstSel.id) : null;
    const currentFill = anchorShape?.color || "#ffffff";
    const currentTextOrLineColor = anchorShape?.textColor || anchorText?.color || "#ffffff";

    return (
        <div
            className="absolute z-[10000] pointer-events-auto"
            style={{ left: screenX, top: screenY, transform: 'translateY(-100%)' }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
        >
            {/* Label editor popover for connections */}
            {showLabelEditor && isConnectionOnly && (
                <div className="absolute bottom-full mb-2 left-0 bg-[#1e1e1e] border border-gray-600 rounded-xl shadow-2xl p-3 w-64 flex flex-col gap-2">
                    <p className="text-xs font-semibold text-gray-300 mb-1">Connection Labels</p>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wide">Mid Label</label>
                    <input
                        autoFocus
                        className="bg-[#2a2a2a] text-white text-xs rounded-md px-2 py-1.5 outline-none border border-gray-600 focus:border-blue-500"
                        placeholder="e.g. uses, extends…"
                        value={labelValue}
                        onChange={e => setLabelValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveLabelEdit(); if (e.key === 'Escape') setShowLabelEditor(false); }}
                    />
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wide">Source mult.</label>
                            <input
                                className="w-full bg-[#2a2a2a] text-white text-xs rounded-md px-2 py-1.5 outline-none border border-gray-600 focus:border-blue-500 mt-0.5"
                                placeholder="1, 0..*"
                                value={sourceLabelValue}
                                onChange={e => setSourceLabelValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveLabelEdit(); }}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wide">Target mult.</label>
                            <input
                                className="w-full bg-[#2a2a2a] text-white text-xs rounded-md px-2 py-1.5 outline-none border border-gray-600 focus:border-blue-500 mt-0.5"
                                placeholder="1, 0..*"
                                value={targetLabelValue}
                                onChange={e => setTargetLabelValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveLabelEdit(); }}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                        <button onClick={saveLabelEdit} className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md font-medium">Save</button>
                        <button onClick={() => setShowLabelEditor(false)} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-md">Cancel</button>
                    </div>
                </div>
            )}

            {/* Main toolbar */}
            <div className="bg-[#2a2a2a] border border-gray-600 rounded-lg shadow-xl p-1 flex items-center gap-0.5 flex-wrap max-w-xs">
                {/* Color pickers — shapes only */}
                {hasShapes && !isConnectionOnly && (
                    <>
                        <div className="relative group/fm flex flex-col items-center justify-center p-1.5 hover:bg-gray-700 rounded cursor-pointer transition-colors" title="Fill Color">
                            <PaintBucket size={15} className="text-gray-300 group-hover/fm:text-white" />
                            <input type="color" value={currentFill}
                                onChange={(e) => {
                                    const shapeIds = new Set(selection.filter(s => s.type === 'shape').map(s => s.id));
                                    setShapes(prev => prev.map(s => shapeIds.has(s.id) ? { ...s, color: e.target.value } : s));
                                }}
                                onBlur={() => addToHistory()}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        </div>
                        <div className="relative group/fm flex flex-col items-center justify-center p-1.5 hover:bg-gray-700 rounded cursor-pointer transition-colors" title="Text Color">
                            <Type size={15} className="text-gray-300 group-hover/fm:text-white" />
                            <input type="color" value={currentTextOrLineColor}
                                onChange={(e) => {
                                    const shapeIds = new Set(selection.filter(s => s.type === 'shape').map(s => s.id));
                                    const textIds = new Set(selection.filter(s => s.type === 'text').map(s => s.id));
                                    if (shapeIds.size > 0) setShapes(prev => prev.map(s => shapeIds.has(s.id) ? { ...s, textColor: e.target.value } : s));
                                    if (textIds.size > 0) setTexts(prev => prev.map(t => textIds.has(t.id) ? { ...t, color: e.target.value } : t));
                                }}
                                onBlur={() => addToHistory()}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        </div>
                        <div className="w-px h-5 bg-gray-600 mx-0.5" />
                    </>
                )}

                {/* Connection label editor button */}
                {isConnectionOnly && (
                    <>
                        <button
                            className={`p-1.5 rounded text-gray-300 hover:text-white transition-colors ${showLabelEditor ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
                            title="Edit Labels & Multiplicity"
                            onClick={openLabelEditor}
                        >
                            <Tag size={15} />
                        </button>
                        <div className="w-px h-5 bg-gray-600 mx-0.5" />
                    </>
                )}

                {/* Alignment tools — only when 2+ shapes selected */}
                {multipleShapes && (
                    <>
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors" title="Align Left" onClick={() => alignShapes('left')}><AlignLeft size={15} /></button>
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors" title="Align Center (H)" onClick={() => alignShapes('center-h')}><AlignCenter size={15} /></button>
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors" title="Align Right" onClick={() => alignShapes('right')}><AlignRight size={15} /></button>
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors" title="Align Top" onClick={() => alignShapes('top')}><AlignStartVertical size={15} /></button>
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors" title="Align Middle (V)" onClick={() => alignShapes('center-v')}><AlignCenterVertical size={15} /></button>
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors" title="Align Bottom" onClick={() => alignShapes('bottom')}><AlignEndVertical size={15} /></button>
                        {selectedShapes.length >= 3 && (
                            <>
                                <button className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors" title="Distribute Horizontally" onClick={() => distributeShapes('h')}><AlignHorizontalDistributeCenter size={15} /></button>
                                <button className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors" title="Distribute Vertically" onClick={() => distributeShapes('v')}><AlignVerticalDistributeCenter size={15} /></button>
                            </>
                        )}
                        <div className="w-px h-5 bg-gray-600 mx-0.5" />
                    </>
                )}

                {/* Layer order */}
                {!isConnectionOnly && (
                    <>
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors" title="Bring to Front" onClick={bringToFront}><ArrowUpToLine size={15} /></button>
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors" title="Send to Back" onClick={sendToBack}><ArrowDownToLine size={15} /></button>
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors" title="Duplicate" onClick={duplicate}><Copy size={15} /></button>
                        <div className="w-px h-5 bg-gray-600 mx-0.5" />
                    </>
                )}

                <button className="p-1.5 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition-colors" title="Delete" onClick={deleteSelection}><Trash2 size={15} /></button>
            </div>
        </div>
    );
};
