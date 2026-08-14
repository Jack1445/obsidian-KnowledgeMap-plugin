import { describe, expect, it } from 'vitest';
import type { FolderGraph, SavedNodePosition } from '../src/core/graph';
import { relaxNewPositions } from '../src/services/initial-layout';

describe('initial layout relaxation', () => {
	it('keeps automatically placed new nodes within the initial map radius', () => {
		const graph: FolderGraph = {
			folderPath: '/',
			nodes: [
				{ id: 'folder:existing', path: 'existing', label: 'Existing', kind: 'folder' },
				{ id: 'folder:new', path: 'new', label: 'New', kind: 'folder' },
			],
			edges: [],
		};
		const positions: Record<string, SavedNodePosition> = {
			'folder:existing': { x: -150, y: -150, fixed: true },
			'folder:new': { x: -500, y: 400, fixed: false },
		};

		relaxNewPositions(graph, positions, new Set(['folder:new']));

		const newPosition = positions['folder:new'];
		expect(newPosition).toBeDefined();
		if (!newPosition) {
			throw new Error('Expected the new node position to exist');
		}
		expect(Math.hypot(newPosition.x, newPosition.y)).toBeLessThanOrEqual(280.001);
	});
});
