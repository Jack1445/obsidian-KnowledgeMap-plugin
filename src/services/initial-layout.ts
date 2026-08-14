import type { FolderGraph, Point, SavedNodePosition } from '../core/graph';

function hash(value: string): number {
	let result = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		result ^= value.charCodeAt(index);
		result = Math.imul(result, 16777619);
	}
	return result >>> 0;
}

function seededPoint(id: string, index: number, total: number): Point {
	const angle = (index / Math.max(total, 1)) * Math.PI * 2 + (hash(id) % 360) * (Math.PI / 180);
	const radius = 150 + (hash(`${id}:radius`) % 130);
	return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

const MAX_AUTOMATIC_RADIUS = 280;

function clampAutomaticPosition(position: SavedNodePosition): void {
	const distance = Math.hypot(position.x, position.y);
	if (distance <= MAX_AUTOMATIC_RADIUS) return;
	const scale = MAX_AUTOMATIC_RADIUS / distance;
	position.x *= scale;
	position.y *= scale;
}

export function createInitialPositions(
	graph: FolderGraph,
	saved: Record<string, SavedNodePosition>,
): Record<string, SavedNodePosition> {
	const positions: Record<string, SavedNodePosition> = {};
	const movable = graph.nodes.filter((node) => node.kind !== 'current-folder');

	for (const node of graph.nodes) {
		const existing = saved[node.id];
		if (existing) {
			positions[node.id] = existing;
			continue;
		}
		if (node.kind === 'current-folder') {
			positions[node.id] = { x: 0, y: 0, fixed: true };
			continue;
		}
		const index = movable.findIndex((candidate) => candidate.id === node.id);
		positions[node.id] = { ...seededPoint(node.id, index, movable.length), fixed: false };
	}

	return positions;
}

export function relaxNewPositions(
	graph: FolderGraph,
	positions: Record<string, SavedNodePosition>,
	newNodeIds: Set<string>,
): void {
	const nodes = graph.nodes.filter((node) => newNodeIds.has(node.id));
	if (nodes.length === 0) return;

	for (let iteration = 0; iteration < 90; iteration += 1) {
		const movements = new Map<string, Point>();
		for (const node of nodes) movements.set(node.id, { x: 0, y: 0 });

		for (const node of nodes) {
			const position = positions[node.id];
			const movement = movements.get(node.id);
			if (!position || !movement) continue;
			for (const other of graph.nodes) {
				if (node.id === other.id) continue;
				const otherPosition = positions[other.id];
				if (!otherPosition) continue;
				const dx = position.x - otherPosition.x;
				const dy = position.y - otherPosition.y;
				const distanceSquared = Math.max(dx * dx + dy * dy, 900);
				const force = 900 / distanceSquared;
				movement.x += dx * force;
				movement.y += dy * force;
			}
			movement.x += -position.x * 0.002;
			movement.y += -position.y * 0.002;
		}

		for (const edge of graph.edges) {
			const from = positions[edge.from];
			const to = positions[edge.to];
			if (!from || !to) continue;
			const dx = to.x - from.x;
			const dy = to.y - from.y;
			const distance = Math.max(Math.hypot(dx, dy), 1);
			const spring = (distance - 150) * 0.002;
			const fromMovement = movements.get(edge.from);
			const toMovement = movements.get(edge.to);
			if (fromMovement) {
				fromMovement.x += dx * spring;
				fromMovement.y += dy * spring;
			}
			if (toMovement) {
				toMovement.x -= dx * spring;
				toMovement.y -= dy * spring;
			}
		}

		const cooling = 1 - iteration / 100;
		for (const node of nodes) {
			const position = positions[node.id];
			const movement = movements.get(node.id);
			if (!position || !movement) continue;
			position.x += Math.max(-8, Math.min(8, movement.x)) * cooling;
			position.y += Math.max(-8, Math.min(8, movement.y)) * cooling;
			clampAutomaticPosition(position);
		}
	}
}
