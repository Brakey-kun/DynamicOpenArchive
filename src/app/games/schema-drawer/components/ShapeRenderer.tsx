import React from 'react';
import { User, Maximize, StickyNote } from "lucide-react";
import { Shape, Tool } from '../types';

interface ShapeRendererProps {
    shape: Shape;
    isSelected: boolean;
    tool: Tool;
    isVisible: boolean;
    isLocked: boolean;
    onMouseDown: (e: React.MouseEvent, id: string) => void;
    onMouseUp: (e: React.MouseEvent, id: string) => void;
    onResizeMouseDown: (e: React.MouseEvent, id: string) => void;
    onMouseEnter: (e: React.MouseEvent, id: string, hasText: boolean) => void;
    onMouseLeave: (e: React.MouseEvent, id: string) => void;
    updateShapeText: (id: string, text: string) => void;
    updateShapeDetails: (id: string, details: string) => void;
    zIndex: number;
}

export const ShapeRenderer: React.FC<ShapeRendererProps> = React.memo(({
    shape,
    isSelected,
    tool,
    isVisible,
    isLocked,
    onMouseDown,
    onMouseUp,
    onResizeMouseDown,
    onMouseEnter,
    onMouseLeave,
    updateShapeText,
    updateShapeDetails,
    zIndex,
}) => {
    const isConnectMode = tool.startsWith("connect");
    const color = shape.color || "transparent";

    const renderContent = () => {
        switch (shape.type) {
            case "diamond":
                return (
                    <div className={`w-full h-full flex flex-col items-center justify-center relative overflow-hidden group stroke-black ${isSelected ? 'ring-2 ring-blue-500' : ''}`} style={{color: shape.textColor}}>
                        <div className="absolute inset-0 border-2 bg-current" style={{ color, borderColor: 'currentColor', transform: 'rotate(45deg) scale(0.7)' }}></div>
                        <div className="z-10 text-center w-3/4 break-words outline-none cursor-text text-sm" 
                             contentEditable={tool !== "delete" && isSelected && !isLocked}
                             suppressContentEditableWarning
                             onMouseDown={(e) => e.stopPropagation()}
                             onBlur={(e) => {
                                 updateShapeText(shape.id, (e.currentTarget?.innerText || e.currentTarget?.textContent || '').trim());
                             }}>{shape.text}</div>
                    </div>
                );
            case "ellipse":
                return (
                    <div className="w-full h-full rounded-[50%] flex items-center justify-center border-2 p-2 group" style={{ borderColor: isSelected ? '#3b82f6' : 'currentColor', backgroundColor: shape.color, color: shape.textColor }}>
                        <div className="text-center break-words outline-none w-full cursor-text text-sm"
                             contentEditable={tool !== "delete" && isSelected && !isLocked}
                             suppressContentEditableWarning
                             onMouseDown={(e) => e.stopPropagation()}
                             onBlur={(e) => {
                                updateShapeText(shape.id, e.currentTarget.innerText);
                             }}>{shape.text}</div>
                    </div>
                );
            case "actor":
                return (
                    <div className="w-full h-full flex flex-col items-center justify-start group" style={{ color: shape.textColor }}>
                        <User size={Math.min(shape.w, shape.h * 0.6)} className={isSelected ? 'text-blue-500' : ''} />
                        <div className="text-center break-words outline-none w-full mt-1 font-bold cursor-text text-sm"
                             contentEditable={tool !== "delete" && isSelected && !isLocked}
                             suppressContentEditableWarning
                             onMouseDown={(e) => e.stopPropagation()}
                             onBlur={(e) => {
                                updateShapeText(shape.id, e.currentTarget.innerText);
                             }}>{shape.text}</div>
                    </div>
                );
            case "database":
                return (
                    <div className="w-full h-full flex flex-col items-center justify-center relative group" style={{color: shape.textColor}}>
                        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" className={isSelected ? 'stroke-blue-500' : ''} stroke="currentColor" strokeWidth="4" fill={color}>
                            <path d="M 5 20 C 5 5, 95 5, 95 20 C 95 35, 5 35, 5 20 L 5 80 C 5 95, 95 95, 95 80 L 95 20" />
                        </svg>
                        <div className="absolute inset-x-0 bottom-0 top-[20%] flex items-center justify-center p-2">
                             <div className="text-center break-words outline-none w-full cursor-text text-sm"
                                  contentEditable={tool !== "delete" && isSelected && !isLocked}
                                  suppressContentEditableWarning
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onBlur={(e) => {
                                     updateShapeText(shape.id, (e.currentTarget?.innerText || e.currentTarget?.textContent || '').trim());
                                  }}>{shape.text}</div>
                        </div>
                    </div>
                );
            case "class":
                return (
                    <div className={`w-full h-full border-2 flex flex-col bg-opacity-90 group ${isSelected ? 'border-blue-500' : 'border-current'}`} style={{ backgroundColor: shape.color, color: shape.textColor }}>
                        {shape.stereotype && (
                            <div className="text-center text-[10px] italic opacity-70 pt-0.5 select-none">{shape.stereotype}</div>
                        )}
                        <div className="border-b-2 font-bold p-1 text-center bg-black bg-opacity-20 outline-none cursor-text text-sm" style={{ borderColor: 'currentColor' }}
                             contentEditable={tool !== "delete" && isSelected && !isLocked}
                             suppressContentEditableWarning
                             onMouseDown={(e) => e.stopPropagation()}
                             onBlur={(e) => {
                                updateShapeText(shape.id, (e.currentTarget?.innerText || e.currentTarget?.textContent || '').trim());
                             }}>{shape.text}</div>
                        <div className="p-2 flex-1 whitespace-pre-wrap outline-none font-mono text-xs leading-tight cursor-text overflow-hidden"
                             contentEditable={tool !== "delete" && isSelected && !isLocked}
                             suppressContentEditableWarning
                             onMouseDown={(e) => e.stopPropagation()}
                             onBlur={(e) => {
                                updateShapeDetails(shape.id, (e.currentTarget?.innerText || e.currentTarget?.textContent || '').trim());
                             }}>{shape.details}</div>
                    </div>
                );
            case "interface":
                return (
                    <div className={`w-full h-full border-2 flex flex-col bg-opacity-90 group ${isSelected ? 'border-blue-500' : 'border-current'}`} style={{ backgroundColor: shape.color, color: shape.textColor }}>
                        <div className="text-center text-[10px] italic opacity-70 pt-0.5 select-none">{shape.stereotype || '<<interface>>'}</div>
                        <div className="border-b-2 font-bold p-1 text-center bg-black bg-opacity-20 outline-none cursor-text text-sm italic" style={{ borderColor: 'currentColor' }}
                             contentEditable={tool !== "delete" && isSelected && !isLocked}
                             suppressContentEditableWarning
                             onMouseDown={(e) => e.stopPropagation()}
                             onBlur={(e) => {
                                updateShapeText(shape.id, (e.currentTarget?.innerText || e.currentTarget?.textContent || '').trim());
                             }}>{shape.text}</div>
                        <div className="p-2 flex-1 whitespace-pre-wrap outline-none font-mono text-xs leading-tight cursor-text overflow-hidden"
                             contentEditable={tool !== "delete" && isSelected && !isLocked}
                             suppressContentEditableWarning
                             onMouseDown={(e) => e.stopPropagation()}
                             onBlur={(e) => {
                                updateShapeDetails(shape.id, (e.currentTarget?.innerText || e.currentTarget?.textContent || '').trim());
                             }}>{shape.details}</div>
                    </div>
                );
            case "enum":
                return (
                    <div className={`w-full h-full border-2 flex flex-col bg-opacity-90 group ${isSelected ? 'border-blue-500' : 'border-current'}`} style={{ backgroundColor: shape.color, color: shape.textColor }}>
                        <div className="text-center text-[10px] italic opacity-70 pt-0.5 select-none">{shape.stereotype || '<<enumeration>>'}</div>
                        <div className="border-b-2 font-bold p-1 text-center bg-black bg-opacity-20 outline-none cursor-text text-sm" style={{ borderColor: 'currentColor' }}
                             contentEditable={tool !== "delete" && isSelected && !isLocked}
                             suppressContentEditableWarning
                             onMouseDown={(e) => e.stopPropagation()}
                             onBlur={(e) => {
                                updateShapeText(shape.id, (e.currentTarget?.innerText || e.currentTarget?.textContent || '').trim());
                             }}>{shape.text}</div>
                        <div className="p-2 flex-1 whitespace-pre-wrap outline-none font-mono text-xs leading-tight cursor-text overflow-hidden"
                             contentEditable={tool !== "delete" && isSelected && !isLocked}
                             suppressContentEditableWarning
                             onMouseDown={(e) => e.stopPropagation()}
                             onBlur={(e) => {
                                updateShapeDetails(shape.id, (e.currentTarget?.innerText || e.currentTarget?.textContent || '').trim());
                             }}>{shape.details}</div>
                    </div>
                );
            case "package":
                return (
                    <div className={`w-full h-full flex flex-col group ${isSelected ? 'ring-2 ring-blue-500' : ''}`} style={{ color: shape.textColor }}>
                        {/* Package tab */}
                        <div className="h-6 w-1/3 border-2 border-b-0 rounded-t-md flex items-center justify-center" style={{ borderColor: isSelected ? '#3b82f6' : shape.textColor, backgroundColor: shape.color }}>
                            <span className="text-[9px] font-medium truncate px-1">pkg</span>
                        </div>
                        {/* Package body */}
                        <div className="flex-1 border-2 rounded-b-md rounded-tr-md flex flex-col p-2" style={{ borderColor: isSelected ? '#3b82f6' : shape.textColor, backgroundColor: shape.color }}>
                            <div className="font-bold text-sm outline-none cursor-text"
                                 contentEditable={tool !== "delete" && isSelected && !isLocked}
                                 suppressContentEditableWarning
                                 onMouseDown={(e) => e.stopPropagation()}
                                 onBlur={(e) => {
                                    updateShapeText(shape.id, (e.currentTarget?.innerText || e.currentTarget?.textContent || '').trim());
                                 }}>{shape.text}</div>
                        </div>
                    </div>
                );
            case "note":
                return (
                    <div className={`w-full h-full flex flex-col group relative ${isSelected ? 'ring-2 ring-blue-500' : ''}`} style={{ color: shape.textColor }}>
                        <div className="w-full h-full border-2 p-2 flex items-start" style={{ borderColor: isSelected ? '#3b82f6' : '#fbbf24', backgroundColor: '#fef3c7' }}>
                            <div className="text-xs break-words outline-none w-full cursor-text text-gray-800"
                                 contentEditable={tool !== "delete" && isSelected && !isLocked}
                                 suppressContentEditableWarning
                                 onMouseDown={(e) => e.stopPropagation()}
                                 onBlur={(e) => {
                                    updateShapeText(shape.id, (e.currentTarget?.innerText || e.currentTarget?.textContent || '').trim());
                                 }}>{shape.text}</div>
                        </div>
                        {/* Folded corner */}
                        <div className="absolute top-0 right-0 w-4 h-4 border-l-2 border-b-2" style={{ borderColor: '#fbbf24', backgroundColor: '#fde68a' }}></div>
                    </div>
                );
            case "rectangle":
            default:
                return (
                    <div className={`w-full h-full border-2 flex items-center justify-center p-2 group ${isSelected ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'border-current'}`} style={{ backgroundColor: shape.color, color: shape.textColor }}>
                        <div className="text-center break-words outline-none w-full cursor-text text-sm"
                             contentEditable={tool !== "delete" && isSelected && !isLocked}
                             suppressContentEditableWarning
                             onMouseDown={(e) => e.stopPropagation()}
                             onBlur={(e) => {
                                updateShapeText(shape.id, (e.currentTarget?.innerText || e.currentTarget?.textContent || '').trim());
                             }}>{shape.text}</div>
                    </div>
                );
        }
    };

    if (!isVisible) return null;

    const hasTextContent = true;

    return (
        <div
            id={`shape-${shape.id}`}
            className={`absolute select-none group ${
                tool === "delete"
                    ? "hover:ring-2 hover:ring-red-500 cursor-pointer"
                    : tool === "scale"
                    ? "cursor-se-resize"
                    : isConnectMode
                    ? "cursor-crosshair"
                    : "cursor-move"
            }`}
            style={{
                left: shape.x, top: shape.y,
                width: shape.w, height: shape.h,
                backgroundColor: 'transparent',
                zIndex,
                borderRadius: shape.type === 'ellipse' ? '50%' : '0',
            }}
            onMouseDown={(e) => onMouseDown(e, shape.id)}
            onMouseUp={(e) => onMouseUp(e, shape.id)}
            onMouseEnter={(e) => onMouseEnter(e, shape.id, hasTextContent)}
            onMouseLeave={(e) => onMouseLeave(e, shape.id)}
        >
            {renderContent()}

            {isSelected && tool === "select" && (
                <div
                    className="absolute -right-2 -bottom-2 w-5 h-5 bg-blue-500 cursor-se-resize rounded-full border-2 border-white shadow-md z-30 opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => onResizeMouseDown(e, shape.id)}
                >
                    <Maximize size={12} className="text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-90" />
                </div>
            )}
            
            {isConnectMode && (
                <div className="absolute inset-0 ring-2 ring-blue-400 bg-blue-400 bg-opacity-10 opacity-0 hover:opacity-100 transition-opacity rounded-inherit pointer-events-none flex items-center justify-center">
                    <div className="w-3 h-3 bg-white border-2 border-blue-500 rounded-full absolute -top-1.5" />
                    <div className="w-3 h-3 bg-white border-2 border-blue-500 rounded-full absolute -bottom-1.5" />
                    <div className="w-3 h-3 bg-white border-2 border-blue-500 rounded-full absolute -left-1.5" />
                    <div className="w-3 h-3 bg-white border-2 border-blue-500 rounded-full absolute -right-1.5" />
                </div>
            )}
        </div>
    );
});

ShapeRenderer.displayName = 'ShapeRenderer';
