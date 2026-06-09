import React from 'react';
import { 
  Square, Circle, Diamond, Database, User, 
  MousePointer2, Trash2, ArrowRight, CornerDownRight, Maximize, Download, Save, FolderOpen,
  Layers, Code2, Clock, Package, StickyNote, Grid3X3
} from "lucide-react";
import { DiagramType, Tool } from '../types';

interface CanvasToolbarProps {
    diagramType: DiagramType;
    tool: Tool;
    setTool: (tool: Tool) => void;
    onExportPng: () => void;
    onExportProject: () => void;
    onExportSvg: () => void;
    onImportProject: () => void;
    onToggleLayers: () => void;
    onOpenTranslator: () => void;
    onOpenHistory: () => void;
    layersPanelOpen: boolean;
    snapEnabled?: boolean;
    onToggleSnap?: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    diagramType, tool, setTool,
    onExportPng, onExportProject, onExportSvg, onImportProject,
    onToggleLayers, onOpenTranslator, onOpenHistory,
    layersPanelOpen, snapEnabled, onToggleSnap,
}) => {
    const renderActiveTools = () => {
        const tools: { id: string; icon: React.ReactNode; title: string; group?: string }[] = [
            { id: "select", icon: <MousePointer2 size={18} />, title: "Select & Move (V)", group: "general" },
            { id: "scale", icon: <Maximize size={18} />, title: "Scale Shape", group: "general" },
            { id: "text", icon: "T", title: "Text (T)", group: "general" },
        ];

        // Shape tools
        if (diagramType === "flowchart" || diagramType === "general") {
            tools.push({ id: "shape_rectangle", icon: <Square size={18} className="fill-transparent" />, title: "Process (Rectangle)", group: "shapes" });
            tools.push({ id: "shape_diamond", icon: <Diamond size={18} className="fill-transparent" />, title: "Decision (Diamond)", group: "shapes" });
            tools.push({ id: "shape_ellipse", icon: <Circle size={18} className="fill-transparent" />, title: "Terminator (Ellipse)", group: "shapes" });
            tools.push({ id: "shape_database", icon: <Database size={18} className="fill-transparent" />, title: "Database", group: "shapes" });
        }
        
        if (diagramType === "usecase" || diagramType === "general") {
            tools.push({ id: "shape_actor", icon: <User size={18} />, title: "Actor", group: "shapes" });
            if (diagramType === "usecase") {
                tools.push({ id: "shape_ellipse", icon: <Circle size={18} className="fill-transparent" />, title: "Use Case", group: "shapes" });
                tools.push({ id: "shape_rectangle", icon: <Square size={18} className="fill-transparent" />, title: "System Boundary", group: "shapes" });
            }
        }

        if (diagramType === "class" || diagramType === "general") {
            tools.push({ id: "shape_class", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>, title: "Class Box", group: "shapes" });
            tools.push({ id: "shape_interface", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeDasharray="4,2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>, title: "Interface", group: "shapes" });
            tools.push({ id: "shape_enum", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>, title: "Enumeration", group: "shapes" });
        }

        // Package and Note available in all modes
        tools.push({ id: "shape_package", icon: <Package size={18} />, title: "Package", group: "shapes" });
        tools.push({ id: "shape_note", icon: <StickyNote size={18} />, title: "Note", group: "shapes" });

        // Connection tools
        tools.push({ id: "connect_straight", icon: <ArrowRight size={18} />, title: "Association (Solid Arrow)", group: "connections" });
        tools.push({ id: "connect_dashed_straight", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h2"/><path d="M11 12h2"/><path d="M17 12h4"/><path d="M17 8l4 4-4 4"/></svg>, title: "Dependency (Dashed Arrow)", group: "connections" });
        tools.push({ id: "connect_orthogonal", icon: <CornerDownRight size={18} />, title: "Orthogonal Curve", group: "connections" });

        if (diagramType === "class" || diagramType === "general") {
            tools.push({ id: "connect_inheritance", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="16" y2="12"/><polygon points="16,7 22,12 16,17" fill="none" stroke="currentColor" strokeWidth="2"/></svg>, title: "Inheritance (Generalization)", group: "connections" });
            tools.push({ id: "connect_realization", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h3" strokeDasharray="3,2"/><path d="M9 12h3" strokeDasharray="3,2"/><path d="M14 12h2"/><polygon points="16,7 22,12 16,17" fill="none" stroke="currentColor" strokeWidth="2"/></svg>, title: "Realization (Interface Implementation)", group: "connections" });
            tools.push({ id: "connect_composition", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="2,12 7,8 12,12 7,16" fill="currentColor"/><line x1="12" y1="12" x2="22" y2="12"/><polygon points="18,9 22,12 18,15" fill="currentColor"/></svg>, title: "Composition (Filled Diamond)", group: "connections" });
            tools.push({ id: "connect_aggregation", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="2,12 7,8 12,12 7,16" fill="none"/><line x1="12" y1="12" x2="22" y2="12"/><polygon points="18,9 22,12 18,15" fill="currentColor"/></svg>, title: "Aggregation (Open Diamond)", group: "connections" });
        }

        tools.push({ id: "connect_freeform", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14c2 0 2-4 4-4s2 4 4 4 2-4 4-4 2 4 4 4"/></svg>, title: "Freeform Spline", group: "connections" });

        // Delete tool
        tools.push({ id: "delete", icon: <Trash2 size={18} className="text-red-400" />, title: "Delete (Del)", group: "actions" });

        const uniqueTools = Array.from(new Map(tools.map(item => [item.id, item])).values());
        return uniqueTools;
    };

    const allTools = renderActiveTools();

    return (
        <div className="flex items-center gap-1 bg-[#2a2a2a] p-1.5 rounded-lg shadow-inner flex-nowrap justify-center overflow-x-auto no-scrollbar">
            {/* Layer toggle */}
            <button
                className={`w-8 h-8 flex items-center justify-center rounded transition-all duration-200 flex-shrink-0 ${layersPanelOpen ? 'bg-purple-600 shadow-md' : 'hover:bg-gray-600 text-gray-300'}`}
                onClick={onToggleLayers}
                title="Toggle Layers Panel"
            >
                <Layers size={16} className={layersPanelOpen ? 'text-white' : 'text-purple-400'} />
            </button>

            {/* Snap toggle */}
            {onToggleSnap && (
                <button
                    className={`w-8 h-8 flex items-center justify-center rounded transition-all duration-200 flex-shrink-0 ${snapEnabled ? 'bg-green-600 shadow-md' : 'hover:bg-gray-600 text-gray-300'}`}
                    onClick={onToggleSnap}
                    title={snapEnabled ? "Snap to Grid: ON" : "Snap to Grid: OFF"}
                >
                    <Grid3X3 size={16} className={snapEnabled ? 'text-white' : 'text-green-400'} />
                </button>
            )}

            <div className="w-px h-6 bg-gray-600 mx-0.5" />

            {allTools.map((t, i) => {
                // Add separator between groups
                const prevTool = allTools[i - 1];
                const showSep = prevTool && prevTool.group !== t.group;
                return (
                    <React.Fragment key={t.id}>
                        {showSep && <div className="w-px h-5 bg-gray-700 mx-0.5" />}
                        <button
                            className={`w-8 h-8 flex items-center justify-center rounded transition-all duration-200 flex-shrink-0 ${tool === t.id ? "bg-blue-600 shadow-md transform scale-105" : "hover:bg-gray-600 text-gray-300"}`}
                            onClick={() => setTool(t.id as Tool)}
                            title={t.title}
                        >
                            {typeof t.icon === 'string' ? <span className="font-bold text-base leading-none">{t.icon}</span> : t.icon}
                        </button>
                    </React.Fragment>
                );
            })}

            <div className="w-px h-6 bg-gray-600 mx-0.5" />

            {/* Translator */}
            <button
                className="w-8 h-8 flex items-center justify-center rounded transition-all duration-200 flex-shrink-0 hover:bg-gray-600 text-cyan-400 hover:text-cyan-300"
                onClick={onOpenTranslator}
                title="Diagram Translator (JSON / Mermaid / Natural Language)"
            >
                <Code2 size={16} />
            </button>

            {/* History */}
            <button
                className="w-8 h-8 flex items-center justify-center rounded transition-all duration-200 flex-shrink-0 hover:bg-gray-600 text-amber-400 hover:text-amber-300"
                onClick={onOpenHistory}
                title="Project History"
            >
                <Clock size={16} />
            </button>

            <div className="w-px h-6 bg-gray-600 mx-0.5" />

            <button
                className="w-8 h-8 flex items-center justify-center rounded transition-all duration-200 flex-shrink-0 hover:bg-gray-600 text-yellow-400 hover:text-yellow-300"
                onClick={onImportProject}
                title="Open Project (.scmu)"
            >
                <FolderOpen size={16} />
            </button>
            <button
                className="w-8 h-8 flex items-center justify-center rounded transition-all duration-200 flex-shrink-0 hover:bg-gray-600 text-blue-400 hover:text-blue-300"
                onClick={onExportProject}
                title="Save Project (.scmu)"
            >
                <Save size={16} />
            </button>
            <button
                className="w-8 h-8 flex items-center justify-center rounded transition-all duration-200 flex-shrink-0 hover:bg-gray-600 text-green-400 hover:text-green-300"
                onClick={onExportPng}
                title="Export as PNG"
            >
                <Download size={16} />
            </button>
            <button
                className="w-8 h-8 flex items-center justify-center rounded transition-all duration-200 flex-shrink-0 hover:bg-gray-600 text-teal-400 hover:text-teal-300"
                onClick={onExportSvg}
                title="Export as SVG (lossless vector)"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
            </button>
        </div>
    );
};
