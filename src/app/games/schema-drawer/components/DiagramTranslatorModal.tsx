"use client";
import React, { useState, useCallback } from 'react';
import { X, Copy, Check, AlertCircle, Code2 } from 'lucide-react';
import { Shape, Connection, FloatingText, Layer } from '../types';
import {
    toJsonDSL, fromJsonDSL, DiagramDsl,
    toMermaid, fromMermaid,
    toNaturalLanguage
} from '../utils/diagramTranslator';

interface DiagramTranslatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    shapes: Shape[];
    connections: Connection[];
    texts: FloatingText[];
    layers: Layer[];
    diagramType: string;
    onImport: (shapes: Shape[], connections: Connection[], texts: FloatingText[], layers: Layer[]) => void;
}

type Tab = 'json' | 'mermaid' | 'natural';

export const DiagramTranslatorModal: React.FC<DiagramTranslatorModalProps> = ({
    isOpen, onClose, shapes, connections, texts, layers, diagramType, onImport
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('json');
    const [jsonInput, setJsonInput] = useState('');
    const [mermaidInput, setMermaidInput] = useState('');
    const [direction, setDirection] = useState<'export' | 'import'>('export');
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [importSuccess, setImportSuccess] = useState(false);

    if (!isOpen) return null;

    const getExportContent = () => {
        if (activeTab === 'json') return JSON.stringify(toJsonDSL(shapes, connections, layers, diagramType), null, 2);
        if (activeTab === 'mermaid') return toMermaid(shapes, connections, diagramType);
        if (activeTab === 'natural') return toNaturalLanguage(shapes, connections, texts, layers, diagramType);
        return '';
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(getExportContent());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleImport = () => {
        setError(null);
        setImportSuccess(false);
        try {
            let result: { shapes: Shape[]; connections: Connection[]; texts: FloatingText[]; layers: Layer[] };
            if (activeTab === 'json') {
                const dsl: DiagramDsl = JSON.parse(jsonInput);
                if (!Array.isArray(dsl.nodes)) throw new Error('JSON DSL requires a "nodes" array.');
                result = fromJsonDSL(dsl, layers);
            } else if (activeTab === 'mermaid') {
                result = fromMermaid(mermaidInput, layers);
            } else {
                setError('Natural Language export is read-only. Use JSON DSL or Mermaid to import.');
                return;
            }
            onImport(result.shapes, result.connections, result.texts, result.layers);
            setImportSuccess(true);
            setTimeout(() => { setImportSuccess(false); onClose(); }, 1200);
        } catch (e: any) {
            setError(e.message ?? 'Failed to parse input.');
        }
    };

    const tabs: { id: Tab; label: string }[] = [
        { id: 'json', label: 'JSON DSL' },
        { id: 'mermaid', label: 'Mermaid' },
        { id: 'natural', label: 'Natural Language' },
    ];

    const isReadOnly = activeTab === 'natural';
    const exportContent = getExportContent();

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-[#1e1e1e] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden"
                style={{ maxHeight: '85vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700 flex-shrink-0">
                    <Code2 size={18} className="text-blue-400" />
                    <h2 className="text-base font-bold text-white flex-1">Diagram Translator</h2>
                    
                    {/* Direction toggle */}
                    <div className="flex bg-[#2a2a2a] rounded-lg p-0.5 text-xs">
                        <button
                            className={`px-3 py-1.5 rounded-md transition-all ${direction === 'export' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                            onClick={() => setDirection('export')}
                        >
                            Diagram → Code
                        </button>
                        {!isReadOnly && (
                            <button
                                className={`px-3 py-1.5 rounded-md transition-all ${direction === 'import' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                onClick={() => setDirection('import')}
                            >
                                Code → Diagram
                            </button>
                        )}
                    </div>
                    
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-700 flex-shrink-0 px-5">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-400'
                                    : 'border-transparent text-gray-400 hover:text-gray-200'
                            }`}
                            onClick={() => { setActiveTab(tab.id); setError(null); setDirection(tab.id === 'natural' ? 'export' : direction); }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col p-5 gap-3 min-h-0">
                    {/* Syntax hint */}
                    <div className="text-xs text-gray-500 flex gap-2 items-start">
                        {activeTab === 'json' && <span>Simple JSON DSL format. Paste or edit nodes/edges and import back.</span>}
                        {activeTab === 'mermaid' && <span>Mermaid <code className="bg-gray-800 px-1 rounded">flowchart TD</code> / <code className="bg-gray-800 px-1 rounded">classDiagram</code> subset supported.</span>}
                        {activeTab === 'natural' && <span>Read-only. Describes your diagram in plain English using fixed rules — no AI required.</span>}
                    </div>

                    {direction === 'export' ? (
                        /* Export view */
                        <div className="flex-1 relative min-h-0">
                            <textarea
                                readOnly
                                className="w-full h-full bg-[#111] text-green-300 font-mono text-xs rounded-xl p-4 border border-gray-700 outline-none resize-none leading-relaxed scrollbar-thin scrollbar-thumb-gray-600"
                                value={exportContent}
                            />
                            <button
                                className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    copied ? 'bg-green-600 text-white' : 'bg-[#2a2a2a] text-gray-300 hover:bg-gray-600 hover:text-white border border-gray-600'
                                }`}
                                onClick={handleCopy}
                            >
                                {copied ? <Check size={12} /> : <Copy size={12} />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                    ) : (
                        /* Import view */
                        <div className="flex-1 flex flex-col gap-3 min-h-0">
                            <textarea
                                className="flex-1 bg-[#111] text-yellow-200 font-mono text-xs rounded-xl p-4 border border-gray-700 outline-none focus:border-blue-500 resize-none leading-relaxed transition-colors scrollbar-thin scrollbar-thumb-gray-600"
                                placeholder={activeTab === 'json'
                                    ? '{\n  "nodes": [\n    { "id": "a", "shape": "rectangle", "label": "Start" }\n  ],\n  "edges": [\n    { "from": "a", "to": "b" }\n  ]\n}'
                                    : 'flowchart TD\n  A[Start] --> B{Decision}\n  B -->|yes| C((End))\n  B -->|no| A'
                                }
                                value={activeTab === 'json' ? jsonInput : mermaidInput}
                                onChange={(e) => {
                                    setError(null);
                                    if (activeTab === 'json') setJsonInput(e.target.value);
                                    else setMermaidInput(e.target.value);
                                }}
                                spellCheck={false}
                            />

                            {error && (
                                <div className="flex items-start gap-2 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-xs text-red-300">
                                    <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}

                            <button
                                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                    importSuccess
                                        ? 'bg-green-600 text-white'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                                }`}
                                onClick={handleImport}
                            >
                                {importSuccess ? '✓ Imported!' : 'Import Into Canvas'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
