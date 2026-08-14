import type { FolderMapState } from '../core/graph';

export const CURRENT_SCHEMA_VERSION = 1;

export interface GlobePosition {
	lat: number;
	lng: number;
}

export interface KnowledgeMapSettings {
	showExternalLinks: boolean;
	showLabels: boolean;
	nodeScale: number;
	linkScale: number;
}

export interface KnowledgeMapData {
	schemaVersion: number;
	settings: KnowledgeMapSettings;
	mapStates: Record<string, FolderMapState>;
	globePositions: Record<string, Record<string, GlobePosition>>;
}

export const DEFAULT_SETTINGS: KnowledgeMapSettings = {
	showExternalLinks: false,
	showLabels: true,
	nodeScale: 1,
	linkScale: 1,
};

export function createDefaultData(): KnowledgeMapData {
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		settings: { ...DEFAULT_SETTINGS },
		mapStates: {},
		globePositions: {},
	};
}
