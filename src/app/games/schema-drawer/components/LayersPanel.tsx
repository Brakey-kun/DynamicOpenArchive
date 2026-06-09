import React, { useState } from 'react';
import { Layers, Plus, Eye, EyeOff, Lock, Unlock, Trash2, GripVertical, ChevronDown, ChevronRight, Type as TypeIcon, Image as ImageIcon, Pencil, Check } from 'lucide-react';
import { Layer, Shape, FloatingText } from '../types';

interface LayersPanelProps {
    isOpen: boolean;
    onToggle: () => void;
    layers: Layer[];
    shapes: Shape[];
    texts: FloatingText[];
    activeLayerId: string;
    selection: { type: "shape" | "text" | "connection"; id: string }[];
    onSetActiveLayer: (layerId: string) => void;
    onToggleVisibility: (layerId: string) => void;
    onToggleLock: (layerId: string) => void;
    onAddLayer: () => void;
    onDeleteLayer: (layerId: string) => void;
    onRenameLayer: (layerId: string, newName: string) => void;
    onReorderLayers: (newLayers: Layer[]) => void;
    onSelectElement: (id: string, type: 'shape' | 'text' | 'connection', shiftKey: boolean) => void;
    onMoveElementToLayer: (id: string, type: 'shape' | 'text', targetLayerId: string) => void;
    onDeleteElement: (id: string, type: 'shape' | 'text') => void;
    onRenameElement: (id: string, type: 'shape' | 'text', newText: string) => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
    isOpen, onToggle, layers, shapes, texts, activeLayerId, selection = [],
    onSetActiveLayer, onToggleVisibility, onToggleLock, onAddLayer, onDeleteLayer, onRenameLayer, onReorderLayers,
    onSelectElement, onMoveElementToLayer, onDeleteElement, onRenameElement
}) => {
    const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
    const [draggedElement, setDraggedElement] = useState<{ id: string, type: 'shape' | 'text' } | null>(null);
    const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set(layers.map(l => l.id)));
    const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
    const [editingLayerName, setEditingLayerName] = useState<string>('');
    const [editingElementId, setEditingElementId] = useState<string | null>(null);
    const [editingElementName, setEditingElementName] = useState<string>('');

    if (!isOpen) return null;

    // Highest layer is at index N-1, so reverse for UI
    const reversedLayers = [...layers].reverse();

    const handleDragStartLayer = (e: React.DragEvent, id: string) => {
        setDraggedLayerId(id);
        e.dataTransfer.setData('text/plain', `layer:${id}`);
        e.stopPropagation();
    };

    const handleDragOverLayer = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDropLayer = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        
        // Handle element drop into a layer
        if (data.startsWith('element:')) {
            const [_, type, id] = data.split(':');
            onMoveElementToLayer(id, type as 'shape' | 'text', targetId);
            setDraggedElement(null);
            return;
        }

        // Handle layer reordering
        if (!draggedLayerId || draggedLayerId === targetId) return;

        const newLayers = [...layers];
        const draggedIdx = newLayers.findIndex(l => l.id === draggedLayerId);
        const targetIdx = newLayers.findIndex(l => l.id === targetId);

        if (draggedIdx > -1 && targetIdx > -1) {
            const [moved] = newLayers.splice(draggedIdx, 1);
            newLayers.splice(targetIdx, 0, moved);
            onReorderLayers(newLayers);
        }
        setDraggedLayerId(null);
    };

    const handleDragStartElement = (e: React.DragEvent, id: string, type: 'shape' | 'text') => {
        setDraggedElement({ id, type });
        e.dataTransfer.setData('text/plain', `element:${type}:${id}`);
        e.stopPropagation();
    };

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedLayers(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="w-64 bg-[#1e1e1e] border-r border-gray-700 flex flex-col h-full shrink-0 z-[10000]">
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Layers size={18} className="text-purple-400" />
                    <span className="font-semibold text-sm">Layers</span>
                </div>
                <button 
                    onClick={onAddLayer}
                    className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                    title="Add Layer"
                >
                    <Plus size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {reversedLayers.map((layer) => {
                    const layerShapes = shapes.filter(s => s.layerId === layer.id);
                    const layerTexts = texts.filter(t => t.layerId === layer.id);
                    const itemsCount = layerShapes.length + layerTexts.length;
                    const isExpanded = expandedLayers.has(layer.id);
                    const isActive = layer.id === activeLayerId;

                    return (
                        <div key={layer.id} className="border-b border-gray-800/50">
                            {/* Layer Header */}
                            <div 
                                draggable
                                onDragStart={(e) => handleDragStartLayer(e, layer.id)}
                                onDragOver={(e) => handleDragOverLayer(e, layer.id)}
                                onDrop={(e) => handleDropLayer(e, layer.id)}
                                onClick={() => onSetActiveLayer(layer.id)}
                                className={`flex items-center gap-2 p-2 cursor-pointer transition-colors ${isActive ? 'bg-blue-600/20 shadow-[inset_2px_0_0_#3b82f6]' : 'hover:bg-[#2a2a2a]'} ${draggedLayerId === layer.id ? 'opacity-50' : ''}`}
                            >
                                <div className="text-gray-500 cursor-grab">
                                    <GripVertical size={14} />
                                </div>
                                <button onClick={(e) => toggleExpand(layer.id, e)} className="text-gray-400 hover:text-white p-0.5">
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                
                                {editingLayerId === layer.id ? (
                                    <input
                                        autoFocus
                                        className="flex-1 min-w-0 bg-gray-800 text-xs px-1 py-0.5 rounded outline-none border border-blue-500 text-white"
                                        value={editingLayerName}
                                        onChange={(e) => setEditingLayerName(e.target.value)}
                                        onBlur={() => {
                                            if (editingLayerName.trim()) onRenameLayer(layer.id, editingLayerName.trim());
                                            setEditingLayerId(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                if (editingLayerName.trim()) onRenameLayer(layer.id, editingLayerName.trim());
                                                setEditingLayerId(null);
                                            }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span 
                                        className="flex-1 truncate text-sm font-medium select-none"
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            setEditingLayerId(layer.id);
                                            setEditingLayerName(layer.name);
                                        }}
                                    >
                                        {layer.name} <span className="text-xs text-gray-500 font-normal ml-1">({itemsCount})</span>
                                    </span>
                                )}

                                <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }}
                                        className={`p-1 rounded ${layer.locked ? 'text-red-400' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                                        title={layer.locked ? "Unlock" : "Lock"}
                                    >
                                        {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                                        className={`p-1 rounded ${!layer.visible ? 'text-gray-600' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                                        title={layer.visible ? "Hide" : "Show"}
                                    >
                                        {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </button>
                                    {layers.length > 1 && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                                            className="p-1 rounded text-red-500 hover:bg-red-500/20 hover:text-red-400"
                                            title="Delete Layer"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Elements List */}
                            {isExpanded && itemsCount > 0 && (
                                <div className="bg-[#151515] py-1 border-t border-gray-800/50">
                                    {layerShapes.map(shape => {
                                        const isSelected = selection.some(s => s.type === 'shape' && s.id === shape.id);
                                        const isEditing = editingElementId === shape.id;
                                        return (
                                            <div 
                                                key={shape.id}
                                                draggable
                                                onDragStart={(e) => handleDragStartElement(e, shape.id, 'shape')}
                                                onClick={(e) => onSelectElement(shape.id, 'shape', e.shiftKey)}
                                                className={`flex items-center gap-2 pl-8 pr-2 py-1.5 cursor-pointer text-xs group transition-colors ${isSelected ? 'bg-blue-600/30 text-white' : 'text-gray-400 hover:bg-[#252525] hover:text-gray-200'}`}
                                            >
                                                <ImageIcon size={12} className={isSelected ? "text-blue-300" : "text-gray-500"} />
                                                
                                                {isEditing ? (
                                                    <input
                                                        autoFocus
                                                        className="flex-1 min-w-0 bg-gray-800 px-1 rounded outline-none border border-blue-500 text-white select-none text-xs"
                                                        value={editingElementName}
                                                        onChange={(e) => setEditingElementName(e.target.value)}
                                                        onBlur={() => {
                                                            if (editingElementName.trim()) onRenameElement(shape.id, 'shape', editingElementName);
                                                            setEditingElementId(null);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                if (editingElementName.trim()) onRenameElement(shape.id, 'shape', editingElementName);
                                                                setEditingElementId(null);
                                                            }
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <span className="flex-1 truncate">{shape.text || shape.type}</span>
                                                )}

                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingElementId(shape.id);
                                                            setEditingElementName(shape.text);
                                                        }}
                                                    >
                                                        <Pencil size={10} />
                                                    </button>
                                                    <button 
                                                        className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"
                                                        onClick={(e) => { e.stopPropagation(); onDeleteElement(shape.id, 'shape'); }}
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {layerTexts.map(text => {
                                        const isSelected = selection.some(s => s.type === 'text' && s.id === text.id);
                                        const isEditing = editingElementId === text.id;
                                        return (
                                            <div 
                                                key={text.id}
                                                draggable
                                                onDragStart={(e) => handleDragStartElement(e, text.id, 'text')}
                                                onClick={(e) => onSelectElement(text.id, 'text', e.shiftKey)}
                                                className={`flex items-center gap-2 pl-8 pr-2 py-1.5 cursor-pointer text-xs group transition-colors ${isSelected ? 'bg-blue-600/30 text-white' : 'text-gray-400 hover:bg-[#252525] hover:text-gray-200'}`}
                                            >
                                                <TypeIcon size={12} className={isSelected ? "text-blue-300" : "text-gray-500"} />
                                                
                                                {isEditing ? (
                                                    <input
                                                        autoFocus
                                                        className="flex-1 min-w-0 bg-gray-800 px-1 rounded outline-none border border-blue-500 text-white select-none text-xs"
                                                        value={editingElementName}
                                                        onChange={(e) => setEditingElementName(e.target.value)}
                                                        onBlur={() => {
                                                            if (editingElementName.trim()) onRenameElement(text.id, 'text', editingElementName);
                                                            setEditingElementId(null);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                if (editingElementName.trim()) onRenameElement(text.id, 'text', editingElementName);
                                                                setEditingElementId(null);
                                                            }
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <span className="flex-1 truncate">{text.text}</span>
                                                )}

                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingElementId(text.id);
                                                            setEditingElementName(text.text);
                                                        }}
                                                    >
                                                        <Pencil size={10} />
                                                    </button>
                                                    <button 
                                                        className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"
                                                        onClick={(e) => { e.stopPropagation(); onDeleteElement(text.id, 'text'); }}
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            
            {/* Context/Hints */}
            <div className="p-3 border-t border-gray-700/50 bg-[#1a1a1a] text-[10px] text-gray-500 leading-tight">
                Tip: Drag items between layers. Hold Shift to select multiple elements.
            </div>
        </div>
    );
};
