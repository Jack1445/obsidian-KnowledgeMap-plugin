export type MapNodeKind = 'current-folder' | 'parent-folder' | 'folder' | 'note' | 'external-note';

export interface MapNode {
	id: string;
	path: string;
	label: string;
	kind: MapNodeKind;
}

export interface MapEdge {
	id: string;
	from: string;
	to: string;
	kind: 'link';
	weight: number;
}

export interface FolderGraph {
	folderPath: string;
	nodes: MapNode[];
	edges: MapEdge[];
}

export interface Point {
	x: number;
	y: number;
}

export interface ViewportState extends Point {
	zoom: number;
}

export interface SavedNodePosition extends Point {
	fixed: boolean;
}

export interface FolderMapState {
	viewport: ViewportState;
	nodes: Record<string, SavedNodePosition>;
}

export const ROOT_PATH = '/';

export function nodeId(kind: MapNodeKind, path: string): string {
	return `${kind}:${path}`;
}
