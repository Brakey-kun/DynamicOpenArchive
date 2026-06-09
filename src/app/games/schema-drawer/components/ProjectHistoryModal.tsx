"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { X, Clock, Download, Trash2, Pencil, Check, PackageOpen, ArchiveIcon, FolderOpen } from 'lucide-react';
import { HistoryEntry, ProjectSave } from '../types';
import {
    getAllHistoryEntries,
    deleteHistoryEntry,
    renameHistoryEntry,
} from '../utils/historyStorage';
import { exportProject, exportHistoryArchive } from '../utils/fileUtils';

interface ProjectHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadEntry: (data: ProjectSave) => void;
    onExportPngForEntry?: (entry: HistoryEntry) => Promise<string | null>;
}

function formatDate(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export const ProjectHistoryModal: React.FC<ProjectHistoryModalProps> = ({
    isOpen, onClose, onLoadEntry
}) => {
    const [entries, setEntries] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    const loadEntries = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAllHistoryEntries();
            setEntries(data);
        } catch (e) {
            console.error('Failed to load history:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) loadEntries();
    }, [isOpen, loadEntries]);

    if (!isOpen) return null;

    const handleDelete = async (id: string) => {
        await deleteHistoryEntry(id);
        setConfirmDeleteId(null);
        await loadEntries();
    };

    const handleRename = async (id: string) => {
        if (editingName.trim()) {
            await renameHistoryEntry(id, editingName.trim());
        }
        setEditingId(null);
        await loadEntries();
    };

    const handleExportAll = async () => {
        if (entries.length === 0) return;
        setExporting(true);
        try {
            await exportHistoryArchive(entries);
        } catch (e) {
            console.error('Archive export failed:', e);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-[#1e1e1e] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden"
                style={{ maxHeight: '88vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-700 flex-shrink-0">
                    <Clock size={18} className="text-amber-400" />
                    <h2 className="text-base font-bold text-white flex-1">Project History</h2>
                    <span className="text-xs text-gray-500">{entries.length} snapshot{entries.length !== 1 ? 's' : ''}</span>
                    
                    <button
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            exporting
                                ? 'bg-amber-700/40 border-amber-600 text-amber-300 cursor-wait'
                                : 'bg-[#2a2a2a] border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white'
                        }`}
                        onClick={handleExportAll}
                        disabled={exporting || entries.length === 0}
                        title="Export all history as ZIP archive (includes project files + thumbnails)"
                    >
                        <ArchiveIcon size={13} />
                        {exporting ? 'Zipping…' : 'Export All (.zip)'}
                    </button>
                    
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 min-h-0">
                    {loading && (
                        <div className="flex items-center justify-center py-16 text-gray-500 text-sm">Loading history…</div>
                    )}
                    {!loading && entries.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
                            <FolderOpen size={40} className="text-gray-700" />
                            <p className="text-sm">No snapshots yet.</p>
                            <p className="text-xs text-gray-600">Snapshots are saved automatically when you export a project.</p>
                        </div>
                    )}

                    {!loading && entries.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {entries.map(entry => (
                                <div
                                    key={entry.id}
                                    className="bg-[#151515] border border-gray-700/60 rounded-xl overflow-hidden flex flex-col group hover:border-gray-500 transition-all hover:shadow-lg hover:shadow-black/40"
                                >
                                    {/* Thumbnail */}
                                    <div
                                        className="aspect-video bg-[#111] relative overflow-hidden cursor-pointer"
                                        onClick={() => { onLoadEntry(entry.projectData); onClose(); }}
                                        title="Click to open this snapshot"
                                    >
                                        {entry.thumbnail ? (
                                            <img
                                                src={entry.thumbnail}
                                                alt={entry.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <PackageOpen size={28} className="text-gray-700" />
                                            </div>
                                        )}
                                        {/* Open overlay */}
                                        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                            <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-md font-medium">Open</span>
                                        </div>
                                    </div>

                                    {/* Info + actions */}
                                    <div className="p-3 flex flex-col gap-2">
                                        {/* Name */}
                                        {editingId === entry.id ? (
                                            <div className="flex gap-1">
                                                <input
                                                    autoFocus
                                                    className="flex-1 bg-gray-800 text-white text-xs rounded px-1.5 py-1 outline-none border border-blue-500 min-w-0"
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRename(entry.id);
                                                        if (e.key === 'Escape') setEditingId(null);
                                                    }}
                                                />
                                                <button
                                                    className="p-1 bg-blue-600 hover:bg-blue-500 rounded text-white"
                                                    onClick={() => handleRename(entry.id)}
                                                >
                                                    <Check size={11} />
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-xs font-medium text-gray-200 truncate leading-snug" title={entry.name}>{entry.name}</p>
                                        )}

                                        <p className="text-[10px] text-gray-500">{formatDate(entry.savedAt)}</p>

                                        {/* Counts */}
                                        <p className="text-[10px] text-gray-600">
                                            {entry.projectData.shapes.length} shapes · {entry.projectData.connections.length} connections
                                        </p>

                                        {/* Action row */}
                                        <div className="flex gap-1 mt-1">
                                            <button
                                                className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[10px] bg-gray-800 hover:bg-blue-700/60 text-gray-400 hover:text-white transition-colors"
                                                onClick={() => { setEditingId(entry.id); setEditingName(entry.name); }}
                                                title="Rename"
                                            >
                                                <Pencil size={10} />
                                            </button>
                                            <button
                                                className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[10px] bg-gray-800 hover:bg-green-700/60 text-gray-400 hover:text-white transition-colors"
                                                onClick={() => exportProject(entry.projectData, `${entry.name}.scmu`)}
                                                title="Download project file"
                                            >
                                                <Download size={10} />
                                            </button>
                                            {confirmDeleteId === entry.id ? (
                                                <button
                                                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[10px] bg-red-700 text-white transition-colors"
                                                    onClick={() => handleDelete(entry.id)}
                                                >
                                                    Confirm
                                                </button>
                                            ) : (
                                                <button
                                                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[10px] bg-gray-800 hover:bg-red-700/60 text-gray-400 hover:text-red-300 transition-colors"
                                                    onClick={() => setConfirmDeleteId(entry.id)}
                                                    title="Delete snapshot"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
