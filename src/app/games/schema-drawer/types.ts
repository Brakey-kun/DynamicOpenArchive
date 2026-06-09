export type ShapeType = "rectangle" | "ellipse" | "diamond" | "actor" | "database" | "class" | "interface" | "enum" | "package" | "note";
export type DiagramType = "flowchart" | "class" | "usecase" | "general";

export type ConnectionEndpoint = "none" | "arrow" | "open-arrow" | "filled-diamond" | "open-diamond" | "filled-triangle" | "open-triangle" | "circle" | "cross";

export interface Layer {
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
}

export interface Shape {
    id: string;
    type: ShapeType;
    x: number;
    y: number;
    w: number;
    h: number;
    text: string;
    details?: string;
    stereotype?: string; // e.g. "<<interface>>", "<<abstract>>", "<<enum>>"
    color: string;
    textColor: string;
    layerId: string;
}

export interface Connection {
    id: string;
    fromId: string;
    toId: string;
    color: string;
    dashed: boolean;
    label?: string;
    sourceLabel?: string; // multiplicity at source end (e.g. "1", "0..*")
    targetLabel?: string; // multiplicity at target end
    sourceEndpoint?: ConnectionEndpoint;
    targetEndpoint?: ConnectionEndpoint;
    type: "straight" | "orthogonal" | "freeform";
    waypoints?: { x: number; y: number }[];
    layerId?: string;
}

export interface FloatingText {
    id: string;
    x: number;
    y: number;
    text: string;
    color: string;
    layerId: string;
}

export type Tool = "select" | "scale" | "shape_rectangle" | "shape_ellipse" | "shape_diamond" | "shape_actor" | "shape_database" | "shape_class" | "shape_interface" | "shape_enum" | "shape_package" | "shape_note" | "connect_straight" | "connect_orthogonal" | "connect_freeform" | "connect_dashed_straight" | "connect_dashed_orthogonal" | "connect_dashed_freeform" | "connect_inheritance" | "connect_realization" | "connect_composition" | "connect_aggregation" | "text" | "delete";

export const COLORS = [
    "#4b5563", "#ffffff", "#ffcccc", "#ccffcc", "#ccccff", "#ffffcc", "#ffccff", 
    "#ccffff", "#e0e0e0", "#ff0000", "#00ff00", "#0000ff", "#000000",
];

export interface CanvasTransform {
    x: number; // pan offset X
    y: number; // pan offset Y
    scale: number; // zoom level
}

export interface ProjectSave {
    version: string;
    diagramType: DiagramType;
    shapes: Shape[];
    connections: Connection[];
    texts: FloatingText[];
    layers: Layer[];
}

export interface HistoryEntry {
    id: string;
    name: string;
    savedAt: number; // Date.now()
    projectData: ProjectSave;
    thumbnail?: string; // base64 PNG data URL
}

// Grid/snap settings
export const GRID_SIZE = 20;
export const SNAP_THRESHOLD = 10;

export function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
    return Math.round(value / gridSize) * gridSize;
}
