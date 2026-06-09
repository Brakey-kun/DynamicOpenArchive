import { Shape, ConnectionEndpoint } from '../types';

export const getIntersectionParams = (s: {x:number, y:number, w:number, h:number}, c: {x:number, y:number}, t: {x:number, y:number}) => {
    const dx = t.x - c.x;
    const dy = t.y - c.y;
    if (dx === 0 && dy === 0) return c;
    const scaleX = Math.abs(dx) > 0.001 ? Math.abs((s.w / 2) / dx) : Infinity;
    const scaleY = Math.abs(dy) > 0.001 ? Math.abs((s.h / 2) / dy) : Infinity;
    const scale = Math.min(scaleX, scaleY);
    return { x: c.x + dx * scale, y: c.y + dy * scale };
};

export const calculatePath = (
    fromShape: Shape | null, 
    toShape: Shape | { x: number, y: number, w: number, h: number }, 
    type: "straight" | "orthogonal" | "freeform",
    waypoints: { x: number; y: number }[] = []
) => {
    if (!fromShape || !toShape) return { path: "", p1: {x:0,y:0}, p2: {x:0,y:0}, angle: 0 };
    
    let c1 = { x: fromShape.x + fromShape.w / 2, y: fromShape.y + fromShape.h / 2 };
    
    const hasWaypoints = waypoints.length > 0;
    
    const c2 = ('x' in toShape && 'y' in toShape && !('type' in toShape)) 
        ? { x: toShape.x, y: toShape.y } 
        : { x: (toShape as Shape).x + (toShape as Shape).w / 2, y: (toShape as Shape).y + (toShape as Shape).h / 2 };

    const toShapeRect = ('type' in toShape) ? toShape as Shape : { x: toShape.x - 5, y: toShape.y - 5, w: 10, h: 10 };

    const p1EndRay = hasWaypoints ? waypoints[0] : c2;
    const p1 = getIntersectionParams(fromShape, c1, p1EndRay);
    
    const p2StartRay = hasWaypoints ? waypoints[waypoints.length - 1] : c1;
    const p2 = ('type' in toShape) ? getIntersectionParams(toShapeRect, c2, p2StartRay) : c2;

    if (type === "orthogonal") {
        const midX = p1.x + (p2.x - p1.x) / 2;
        const cp2 = { x: midX, y: p2.y };
        let dx = p2.x - cp2.x;
        let dy = p2.y - cp2.y;
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
            dx = p2.x - p1.x;
            dy = p2.y - p1.y;
        }
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        return {
            path: `M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`,
            p1, p2, angle
        };
    }
    
    if (type === "freeform" && hasWaypoints) {
        let pathStr = `M ${p1.x} ${p1.y} `;
        let pts = [p1, ...waypoints, p2];
        for (let i = 1; i < pts.length - 2; i++) {
            const xc = (pts[i].x + pts[i + 1].x) / 2;
            const yc = (pts[i].y + pts[i + 1].y) / 2;
            pathStr += `Q ${pts[i].x} ${pts[i].y}, ${xc} ${yc} `;
        }
        const secondToLast = pts[pts.length - 2];
        pathStr += `Q ${secondToLast.x} ${secondToLast.y}, ${p2.x} ${p2.y}`;
        
        let dx = p2.x - secondToLast.x;
        let dy = p2.y - secondToLast.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        return {
            path: pathStr,
            p1, p2, angle
        };
    }
    
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
    
    return {
        path: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
        p1, p2, angle
    };
};

/**
 * Renders an SVG marker element for a given connection endpoint type.
 * Returns the SVG path/polygon content for the marker.
 */
export function getEndpointMarkerSVG(
    endpoint: ConnectionEndpoint,
    color: string,
    id: string,
    isSource: boolean = false
): string {
    const size = 14;
    switch (endpoint) {
        case "arrow":
            // Filled triangular arrowhead (standard)
            return `<marker id="${id}" markerWidth="20" markerHeight="14" refX="${isSource ? '1' : '19'}" refY="7" orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="${isSource ? '20 0, 0 7, 20 14' : '0 0, 20 7, 0 14'}" fill="${color}" />
            </marker>`;
        case "open-arrow":
            // Open arrowhead (just lines, no fill)
            return `<marker id="${id}" markerWidth="20" markerHeight="14" refX="${isSource ? '1' : '19'}" refY="7" orient="auto" markerUnits="userSpaceOnUse">
                <polyline points="${isSource ? '20 0, 0 7, 20 14' : '0 0, 20 7, 0 14'}" fill="none" stroke="${color}" stroke-width="2" />
            </marker>`;
        case "filled-triangle":
            // Filled triangle (inheritance - generalization)
            return `<marker id="${id}" markerWidth="20" markerHeight="16" refX="${isSource ? '1' : '19'}" refY="8" orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="${isSource ? '20 0, 0 8, 20 16' : '0 0, 20 8, 0 16'}" fill="white" stroke="${color}" stroke-width="2" />
            </marker>`;
        case "open-triangle":
            // Open triangle (realization)
            return `<marker id="${id}" markerWidth="20" markerHeight="16" refX="${isSource ? '1' : '19'}" refY="8" orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="${isSource ? '20 0, 0 8, 20 16' : '0 0, 20 8, 0 16'}" fill="white" stroke="${color}" stroke-width="2" />
            </marker>`;
        case "filled-diamond":
            // Filled diamond (composition)
            return `<marker id="${id}" markerWidth="20" markerHeight="14" refX="${isSource ? '1' : '19'}" refY="7" orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="${isSource ? '10 0, 0 7, 10 14, 20 7' : '10 0, 20 7, 10 14, 0 7'}" fill="${color}" stroke="${color}" stroke-width="1" />
            </marker>`;
        case "open-diamond":
            // Open diamond (aggregation)
            return `<marker id="${id}" markerWidth="20" markerHeight="14" refX="${isSource ? '1' : '19'}" refY="7" orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="${isSource ? '10 0, 0 7, 10 14, 20 7' : '10 0, 20 7, 10 14, 0 7'}" fill="white" stroke="${color}" stroke-width="2" />
            </marker>`;
        case "circle":
            return `<marker id="${id}" markerWidth="12" markerHeight="12" refX="6" refY="6" orient="auto" markerUnits="userSpaceOnUse">
                <circle cx="6" cy="6" r="5" fill="white" stroke="${color}" stroke-width="2" />
            </marker>`;
        case "cross":
            return `<marker id="${id}" markerWidth="12" markerHeight="12" refX="6" refY="6" orient="auto" markerUnits="userSpaceOnUse">
                <line x1="2" y1="2" x2="10" y2="10" stroke="${color}" stroke-width="2" />
                <line x1="10" y1="2" x2="2" y2="10" stroke="${color}" stroke-width="2" />
            </marker>`;
        case "none":
        default:
            return "";
    }
}

/**
 * Get the default endpoints for a UML relationship tool type
 */
export function getDefaultEndpoints(toolType: string): { sourceEndpoint: ConnectionEndpoint; targetEndpoint: ConnectionEndpoint; dashed: boolean; connType: "straight" | "orthogonal" | "freeform" } {
    switch (toolType) {
        case "connect_inheritance":
            return { sourceEndpoint: "none", targetEndpoint: "filled-triangle", dashed: false, connType: "straight" };
        case "connect_realization":
            return { sourceEndpoint: "none", targetEndpoint: "open-triangle", dashed: true, connType: "straight" };
        case "connect_composition":
            return { sourceEndpoint: "filled-diamond", targetEndpoint: "arrow", dashed: false, connType: "straight" };
        case "connect_aggregation":
            return { sourceEndpoint: "open-diamond", targetEndpoint: "arrow", dashed: false, connType: "straight" };
        case "connect_straight":
            return { sourceEndpoint: "none", targetEndpoint: "arrow", dashed: false, connType: "straight" };
        case "connect_dashed_straight":
            return { sourceEndpoint: "none", targetEndpoint: "arrow", dashed: true, connType: "straight" };
        case "connect_orthogonal":
            return { sourceEndpoint: "none", targetEndpoint: "arrow", dashed: false, connType: "orthogonal" };
        case "connect_dashed_orthogonal":
            return { sourceEndpoint: "none", targetEndpoint: "arrow", dashed: true, connType: "orthogonal" };
        case "connect_freeform":
            return { sourceEndpoint: "none", targetEndpoint: "arrow", dashed: false, connType: "freeform" };
        case "connect_dashed_freeform":
            return { sourceEndpoint: "none", targetEndpoint: "arrow", dashed: true, connType: "freeform" };
        default:
            return { sourceEndpoint: "none", targetEndpoint: "arrow", dashed: false, connType: "straight" };
    }
}
