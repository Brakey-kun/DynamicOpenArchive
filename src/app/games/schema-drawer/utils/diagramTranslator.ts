import { Shape, Connection, FloatingText, Layer, ProjectSave, ShapeType } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// JSON DSL  ↔  Diagram
// ─────────────────────────────────────────────────────────────────────────────

export interface DslNode {
    id: string;
    shape: ShapeType;
    label: string;
    color?: string;
    textColor?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    details?: string;
    layer?: string; // layer name
}

export interface DslEdge {
    from: string;
    to: string;
    label?: string;
    sourceLabel?: string;
    targetLabel?: string;
    style?: 'straight' | 'orthogonal' | 'freeform' | 'dashed' | 'dashed-orthogonal' | 'dashed-freeform' | 'inheritance' | 'realization' | 'composition' | 'aggregation';
    color?: string;
}

export interface DiagramDsl {
    type?: string;
    nodes: DslNode[];
    edges: DslEdge[];
}

const DEFAULT_LAYER_ID = 'default';

function autoLayout(nodes: DslNode[]): DslNode[] {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    return nodes.map((n, i) => ({
        ...n,
        x: n.x ?? 60 + (i % cols) * 200,
        y: n.y ?? 60 + Math.floor(i / cols) * 160,
        w: n.w ?? 150,
        h: n.h ?? 100,
    }));
}

export function fromJsonDSL(dsl: DiagramDsl, existingLayers: Layer[]): {
    shapes: Shape[];
    connections: Connection[];
    texts: FloatingText[];
    layers: Layer[];
} {
    const layoutNodes = autoLayout(dsl.nodes);
    const layerMap = new Map<string, string>(); // layer name → layer id
    const newLayers: Layer[] = [...existingLayers];

    layoutNodes.forEach(n => {
        const layerName = n.layer ?? 'Layer 1';
        if (!layerMap.has(layerName)) {
            const existing = newLayers.find(l => l.name === layerName);
            if (existing) {
                layerMap.set(layerName, existing.id);
            } else {
                const newId = Math.random().toString(36).substring(2, 9);
                newLayers.push({ id: newId, name: layerName, visible: true, locked: false });
                layerMap.set(layerName, newId);
            }
        }
    });

    if (newLayers.length === 0) {
        const lid = DEFAULT_LAYER_ID;
        newLayers.push({ id: lid, name: 'Layer 1', visible: true, locked: false });
        layerMap.set('Layer 1', lid);
    }

    const topLayerId = newLayers[newLayers.length - 1].id;

    const shapes: Shape[] = layoutNodes.map(n => ({
        id: n.id,
        type: n.shape ?? 'rectangle',
        x: n.x!,
        y: n.y!,
        w: n.w!,
        h: n.h!,
        text: n.label,
        details: n.details ?? '',
        color: n.color ?? '#4b5563',
        textColor: n.textColor ?? '#ffffff',
        layerId: layerMap.get(n.layer ?? 'Layer 1') ?? topLayerId,
    }));

    const connections: Connection[] = dsl.edges.map(e => {
        const dashed = e.style?.startsWith('dashed') || e.style === 'realization' ? true : false;
        const connType: 'straight' | 'orthogonal' | 'freeform' =
            e.style === 'orthogonal' || e.style === 'dashed-orthogonal' ? 'orthogonal' :
            e.style === 'freeform' || e.style === 'dashed-freeform' ? 'freeform' : 'straight';
        
        // Map relationship styles to endpoints
        let sourceEndpoint: Connection['sourceEndpoint'] = 'none';
        let targetEndpoint: Connection['targetEndpoint'] = 'arrow';
        if (e.style === 'inheritance') { sourceEndpoint = 'none'; targetEndpoint = 'filled-triangle'; }
        else if (e.style === 'realization') { sourceEndpoint = 'none'; targetEndpoint = 'open-triangle'; }
        else if (e.style === 'composition') { sourceEndpoint = 'filled-diamond'; targetEndpoint = 'arrow'; }
        else if (e.style === 'aggregation') { sourceEndpoint = 'open-diamond'; targetEndpoint = 'arrow'; }

        return {
            id: Math.random().toString(36).substring(2, 9),
            fromId: e.from,
            toId: e.to,
            label: e.label,
            sourceLabel: e.sourceLabel,
            targetLabel: e.targetLabel,
            color: e.color ?? '#ffffff',
            dashed,
            type: connType,
            sourceEndpoint,
            targetEndpoint,
        };
    });

    return { shapes, connections, texts: [], layers: newLayers };
}

export function toJsonDSL(
    shapes: Shape[],
    connections: Connection[],
    layers: Layer[],
    diagramType: string
): DiagramDsl {
    const layerById = new Map(layers.map(l => [l.id, l]));
    const nodes: DslNode[] = shapes.map(s => ({
        id: s.id,
        shape: s.type,
        label: s.text,
        color: s.color,
        textColor: s.textColor,
        x: Math.round(s.x),
        y: Math.round(s.y),
        w: Math.round(s.w),
        h: Math.round(s.h),
        ...(s.details ? { details: s.details } : {}),
        layer: layerById.get(s.layerId)?.name ?? 'Layer 1',
    }));

    const edges: DslEdge[] = connections.map(c => {
        let style: DslEdge['style'] = c.type === 'straight' ? 'straight' : c.type === 'orthogonal' ? 'orthogonal' : 'freeform';
        if (c.dashed && style === 'straight') style = 'dashed';
        if (c.dashed && style === 'orthogonal') style = 'dashed-orthogonal';
        if (c.dashed && style === 'freeform') style = 'dashed-freeform';
        // Map UML relationship endpoints back to named styles
        if (c.targetEndpoint === 'filled-triangle' && !c.dashed) style = 'inheritance';
        if (c.targetEndpoint === 'open-triangle' && c.dashed) style = 'realization';
        if (c.sourceEndpoint === 'filled-diamond') style = 'composition';
        if (c.sourceEndpoint === 'open-diamond') style = 'aggregation';
        return {
            from: c.fromId,
            to: c.toId,
            ...(c.label ? { label: c.label } : {}),
            ...(c.sourceLabel ? { sourceLabel: c.sourceLabel } : {}),
            ...(c.targetLabel ? { targetLabel: c.targetLabel } : {}),
            style,
            color: c.color,
        };
    });

    return { type: diagramType, nodes, edges };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mermaid  ↔  Diagram
// ─────────────────────────────────────────────────────────────────────────────

const SHAPE_TO_MERMAID: Record<ShapeType, (label: string) => string> = {
    rectangle:  l => `[${l}]`,
    ellipse:    l => `((${l}))`,
    diamond:    l => `{${l}}`,
    actor:      l => `>${l}]`,
    database:   l => `[(${l})]`,
    class:      l => `[${l}]`,
    interface:  l => `[${l}]`,
    enum:       l => `[${l}]`,
    package:    l => `[${l}]`,
    note:       l => `[${l}]`,
};

const MERMAID_TO_SHAPE = (raw: string): { type: ShapeType; label: string } => {
    if (/^\(\(.*\)\)$/.test(raw)) return { type: 'ellipse', label: raw.slice(2, -2) };
    if (/^\{.*\}$/.test(raw)) return { type: 'diamond', label: raw.slice(1, -1) };
    if (/^\[\(.*\)\]$/.test(raw)) return { type: 'database', label: raw.slice(2, -2) };
    if (/^\[.*\]$/.test(raw)) return { type: 'rectangle', label: raw.slice(1, -1) };
    if (/^>.*\]$/.test(raw)) return { type: 'actor', label: raw.slice(1, -1) };
    return { type: 'rectangle', label: raw.replace(/^[\[\{>]|[\]\}]$/g, '') };
};

export function toMermaid(shapes: Shape[], connections: Connection[], diagramType: string): string {
    const dir = 'TD';
    const header = diagramType === 'class' ? 'classDiagram' : `flowchart ${dir}`;
    const lines: string[] = [header];

    shapes.forEach(s => {
        const shapeFn = SHAPE_TO_MERMAID[s.type] ?? SHAPE_TO_MERMAID.rectangle;
        lines.push(`  ${s.id}${shapeFn(s.text.replace(/\n/g, ' '))}`);
    });

    connections.forEach(c => {
        let arrow = c.dashed ? '-.->' : '-->';
        // UML-specific arrows
        if (c.targetEndpoint === 'filled-triangle') arrow = '--|>';
        else if (c.targetEndpoint === 'open-triangle') arrow = c.dashed ? '..|>' : '--|>';
        else if (c.sourceEndpoint === 'filled-diamond') arrow = '*-->';
        else if (c.sourceEndpoint === 'open-diamond') arrow = 'o-->';
        const labelPart = c.label ? `|${c.label}|` : '';
        lines.push(`  ${c.fromId} ${arrow}${labelPart} ${c.toId}`);
    });

    return lines.join('\n');
}

export function fromMermaid(mermaidText: string, existingLayers: Layer[]): {
    shapes: Shape[];
    connections: Connection[];
    texts: FloatingText[];
    layers: Layer[];
} {
    const lines = mermaidText.split('\n').map(l => l.trim()).filter(Boolean);
    const nodes = new Map<string, { type: ShapeType; label: string }>();
    const edges: { from: string; to: string; label?: string; dashed: boolean }[] = [];

    // Regex patterns
    // Node: ID[Label] or ID((Label)) etc
    const nodeRe = /^(\w+)((\[.*?\])|(\(\(.*?\)\))|(\{.*?\})|(\(.*?\))|(\[.*?\))|(\(.*?\])|(\s*>.+?\]))$/;
    // Edge: ID --> ID or ID -.-> ID with optional label
    const edgeRe = /^(\w+)\s*(-->|--?>|-.->|-\.->)\|?([^|]*)?\|?\s*(\w+)(.*)$/;
    // Node with inline edge definition: A[Label] --> B
    const inlineNodeEdgeRe = /^(\w+)((\[.*?\])|(\(\(.*?\)\))|(\{.*?\})|(\[.*?\)))\s*(-->|--?>|-.->|-\.->)\|?([^|]*)?\|?\s*(\w+)((\[.*?\])|(\(\(.*?\)\))|(\{.*?\})|(\[.*?\)))?/;

    lines.forEach(line => {
        if (line.startsWith('flowchart') || line.startsWith('graph') || line.startsWith('classDiagram') || line.startsWith('%%')) return;

        // Try full inline "A[x] --> B[y]" style
        const inlineMatch = line.match(/^(\w+)([\[\{(][^)\]]*[\]\})])\s*(-->|-\.->|-.->)\|?([^|]*)?\|?\s+(\w+)([\[\{(][^)\]]*[\]\})])?/);
        if (inlineMatch) {
            const [, id1, shape1Str, arrowStr, lbl, id2, shape2Str] = inlineMatch;
            if (!nodes.has(id1)) nodes.set(id1, MERMAID_TO_SHAPE(shape1Str));
            if (shape2Str && !nodes.has(id2)) nodes.set(id2, MERMAID_TO_SHAPE(shape2Str));
            else if (!nodes.has(id2)) nodes.set(id2, { type: 'rectangle', label: id2 });
            edges.push({ from: id1, to: id2, label: lbl?.trim() || undefined, dashed: arrowStr.includes('.') });
            return;
        }

        // Try standalone node def
        const nm = line.match(/^(\w+)([\[\{(>][^)\]]*[\]\})]?)\s*$/);
        if (nm && !line.includes('-->') && !line.includes('-.-')) {
            if (!nodes.has(nm[1])) nodes.set(nm[1], MERMAID_TO_SHAPE(nm[2]));
            return;
        }

        // Try plain edge: A --> B or A -.-> B
        const em = line.match(/^(\w+)\s*(-->|-\.->|-.->)\|?([^|]*)?\|?\s+(\w+)\s*$/);
        if (em) {
            const [, from, arrowStr, lbl, to] = em;
            if (!nodes.has(from)) nodes.set(from, { type: 'rectangle', label: from });
            if (!nodes.has(to)) nodes.set(to, { type: 'rectangle', label: to });
            edges.push({ from, to, label: lbl?.trim() || undefined, dashed: arrowStr.includes('.') });
        }
    });

    // Build layers
    let newLayers = [...existingLayers];
    let topLayerId: string;
    if (newLayers.length === 0) {
        topLayerId = Math.random().toString(36).substring(2, 9);
        newLayers = [{ id: topLayerId, name: 'Layer 1', visible: true, locked: false }];
    } else {
        topLayerId = newLayers[newLayers.length - 1].id;
    }

    // Auto-layout
    const nodeIds = Array.from(nodes.keys());
    const cols = Math.ceil(Math.sqrt(nodeIds.length));
    const shapes: Shape[] = nodeIds.map((id, i) => {
        const info = nodes.get(id)!;
        return {
            id,
            type: info.type,
            x: 60 + (i % cols) * 200,
            y: 60 + Math.floor(i / cols) * 160,
            w: 150,
            h: 100,
            text: info.label,
            details: '',
            color: '#4b5563',
            textColor: '#ffffff',
            layerId: topLayerId,
        };
    });

    const connections = edges.map(e => ({
        id: Math.random().toString(36).substring(2, 9),
        fromId: e.from,
        toId: e.to,
        label: e.label,
        color: '#ffffff',
        dashed: e.dashed,
        type: 'straight' as const,
    })).filter(c => shapes.find(s => s.id === c.fromId) && shapes.find(s => s.id === c.toId));

    return { shapes, connections, texts: [], layers: newLayers };
}

// ─────────────────────────────────────────────────────────────────────────────
// Natural Language (diagram → text only)
// ─────────────────────────────────────────────────────────────────────────────

const SHAPE_NAMES: Record<ShapeType, string> = {
    rectangle: 'rectangle',
    ellipse: 'ellipse',
    diamond: 'decision diamond',
    actor: 'actor',
    database: 'database cylinder',
    class: 'class box',
    interface: 'interface box',
    enum: 'enumeration box',
    package: 'package',
    note: 'note',
};

const CONNECTION_TYPE_PHRASES: Record<string, string> = {
    straight: 'directly connects to',
    orthogonal: 'routes orthogonally to',
    freeform: 'curves freely to',
};

export function toNaturalLanguage(
    shapes: Shape[],
    connections: Connection[],
    texts: FloatingText[],
    layers: Layer[],
    diagramType: string
): string {
    const paragraphs: string[] = [];

    // Diagram overview
    paragraphs.push(
        `This is a ${diagramType} diagram containing ${shapes.length} element${shapes.length !== 1 ? 's' : ''}, ` +
        `${connections.length} connection${connections.length !== 1 ? 's' : ''}, ` +
        `and ${texts.length} floating text label${texts.length !== 1 ? 's' : ''} ` +
        `organised across ${layers.length} layer${layers.length !== 1 ? 's' : ''}.`
    );

    // Per-layer breakdown
    layers.forEach((layer, li) => {
        const layerShapes = shapes.filter(s => s.layerId === layer.id);
        const layerTexts = texts.filter(t => t.layerId === layer.id);
        if (layerShapes.length === 0 && layerTexts.length === 0) return;

        const layerRank = li === 0 ? 'background' : li === layers.length - 1 ? 'foreground' : `middle (layer ${li + 1})`;
        let p = `Layer "${layer.name}" (${layerRank}${layer.visible ? '' : ', hidden'}${layer.locked ? ', locked' : ''}) holds `;
        const parts: string[] = [];
        if (layerShapes.length) parts.push(`${layerShapes.length} shape${layerShapes.length !== 1 ? 's' : ''}`);
        if (layerTexts.length) parts.push(`${layerTexts.length} text label${layerTexts.length !== 1 ? 's' : ''}`);
        p += parts.join(' and ') + '. ';

        layerShapes.forEach(s => {
            p += `A ${SHAPE_NAMES[s.type]} labelled "${s.text}" is located at position (${Math.round(s.x)}, ${Math.round(s.y)}) with dimensions ${Math.round(s.w)}×${Math.round(s.h)}. `;
            if (s.details) p += `It contains the following details: ${s.details}. `;
        });

        layerTexts.forEach(t => {
            p += `A floating text label reads: "${t.text}". `;
        });

        paragraphs.push(p.trim());
    });

    // Connections
    if (connections.length > 0) {
        let p = 'Connections: ';
        const connSentences = connections.map(c => {
            const fromShape = shapes.find(s => s.id === c.fromId);
            const toShape = shapes.find(s => s.id === c.toId);
            if (!fromShape || !toShape) return null;
            const phrase = CONNECTION_TYPE_PHRASES[c.type] ?? 'connects to';
            const dashedNote = c.dashed ? ' (dashed)' : '';
            const labelNote = c.label ? ` labelled "${c.label}"` : '';
            // Describe UML relationship type
            let relType = '';
            if (c.targetEndpoint === 'filled-triangle') relType = ' [Inheritance]';
            else if (c.targetEndpoint === 'open-triangle') relType = ' [Realization]';
            else if (c.sourceEndpoint === 'filled-diamond') relType = ' [Composition]';
            else if (c.sourceEndpoint === 'open-diamond') relType = ' [Aggregation]';
            const sourceMult = c.sourceLabel ? ` (${c.sourceLabel})` : '';
            const targetMult = c.targetLabel ? ` (${c.targetLabel})` : '';
            return `"${fromShape.text}"${sourceMult} ${phrase} "${toShape.text}"${targetMult}${labelNote}${dashedNote}${relType}`;
        }).filter(Boolean);
        p += connSentences.join('; ') + '.';
        paragraphs.push(p);
    }

    // Orphaned shapes (on hidden or deleted layers)
    const orphaned = shapes.filter(s => !layers.find(l => l.id === s.layerId));
    if (orphaned.length > 0) {
        paragraphs.push(
            `Note: ${orphaned.length} element${orphaned.length !== 1 ? 's are' : ' is'} on unresolved layers and may not render correctly.`
        );
    }

    return paragraphs.join('\n\n');
}
