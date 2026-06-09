import JSZip from 'jszip';
import { ProjectSave, HistoryEntry } from '../types';

export const exportProject = (data: ProjectSave, filename: string = 'schema-project.scmu') => {
    try {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Failed to export project payload:', error);
    }
};

export const importProject = (file: File): Promise<ProjectSave> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (typeof e.target?.result !== 'string') throw new Error('Invalid file content read.');
                const data: ProjectSave = JSON.parse(e.target.result);
                if (!Array.isArray(data.shapes) || !Array.isArray(data.connections) || !Array.isArray(data.texts)) {
                    throw new Error('Invalid .scmu file structure: Missing critical arrays.');
                }
                // Ensure backwards compat: if layers is missing, create a default
                if (!Array.isArray(data.layers)) {
                    const defaultLayerId = 'default';
                    data.layers = [{ id: defaultLayerId, name: 'Layer 1', visible: true, locked: false }];
                    data.shapes = data.shapes.map(s => ({ ...s, layerId: s.layerId ?? defaultLayerId }));
                    data.texts = data.texts.map(t => ({ ...t, layerId: (t as any).layerId ?? defaultLayerId }));
                }
                resolve(data);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (e) => reject(new Error('File read error: ' + e.target?.error?.message));
        reader.readAsText(file);
    });
};

export const exportHistoryArchive = async (entries: HistoryEntry[]): Promise<void> => {
    const zip = new JSZip();
    
    // Add manifest
    const manifest = entries.map(e => ({
        id: e.id,
        name: e.name,
        savedAt: new Date(e.savedAt).toISOString(),
        hasThumb: !!e.thumbnail,
    }));
    zip.file('history.json', JSON.stringify(manifest, null, 2));

    entries.forEach((entry, i) => {
        const dateStr = new Date(entry.savedAt).toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const safeName = entry.name.replace(/[^a-zA-Z0-9_\- ]/g, '_').slice(0, 40);
        const prefix = `${String(i + 1).padStart(3, '0')}_${safeName}_${dateStr}`;

        // Project file
        zip.file(`projects/${prefix}.scmu`, JSON.stringify(entry.projectData, null, 2));

        // Thumbnail PNG
        if (entry.thumbnail) {
            // Strip data:image/png;base64, prefix
            const base64 = entry.thumbnail.replace(/^data:image\/\w+;base64,/, '');
            zip.file(`thumbnails/${prefix}_thumb.png`, base64, { base64: true });
        }
    });

    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uml-history-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
