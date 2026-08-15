import {
	App,
	Notice,
	setIcon,
	TAbstractFile,
	TFile,
	TFolder,
	type WorkspaceLeaf,
} from 'obsidian';
import type { FolderGraph, MapEdge, MapNode, SavedNodePosition } from '../core/graph';
import { ROOT_PATH } from '../core/graph';
import { folderDisplayName, normalizeFolderPath } from '../core/paths';
import type { KnowledgeMapStore } from '../data/store';
import { VaultGraphBuilder } from '../obsidian/vault-graph-builder';
import { createInitialPositions } from '../services/initial-layout';
import {
	KNOWLEDGE_CANVAS_DATA_KEY,
	parseKnowledgeCanvasLink,
	readKnowledgeCanvasData,
	type KnowledgeCanvasAction,
	type KnowledgeCanvasElementData,
} from './knowledge-canvas-model';

const EXCALIDRAW_VIEW_TYPE = 'excalidraw';
const NODE_SCALE = 1.35;
const FOLDER_SIZE = 112;
const NOTE_SIZE = 84;

interface ExcalidrawElementLike {
	id: string;
	type?: string;
	link?: string | null;
	strokeColor?: string;
	backgroundColor?: string;
	strokeWidth?: number;
	strokeStyle?: string;
	fillStyle?: string;
	roughness?: number;
	opacity?: number;
	fontSize?: number;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	isDeleted?: boolean;
	customData?: Record<string, unknown>;
}

interface ExcalidrawViewLike {
	file?: TFile | null;
	containerEl?: HTMLElement;
	getViewType(): string;
}

interface ExcalidrawStyleLike {
	strokeColor: string;
	backgroundColor: string;
	strokeWidth: number;
	strokeStyle?: string;
	fillStyle?: string;
	roughness?: number;
	fontSize?: number;
}

interface ExcalidrawDropData {
	ea: ExcalidrawAutomateLike;
	event?: {
		dataTransfer?: {
			getData(type: string): string;
			types?: readonly string[];
		} | null;
		nativeEvent?: {
			dataTransfer?: {
				getData(type: string): string;
				types?: readonly string[];
			} | null;
		};
	};
	draggable: unknown;
	type: 'file' | 'text' | 'unknown';
	payload: { files: TFile[] | null; text: string | null };
	excalidrawFile: TFile;
	view: ExcalidrawViewLike;
	pointerPosition: { x: number; y: number };
}

interface ExcalidrawAutomateLike {
	reset(): void;
	addEllipse(x: number, y: number, width: number, height: number, id?: string): string;
	addRect?(x: number, y: number, width: number, height: number, id?: string): string;
	addText(
		x: number,
		y: number,
		text: string,
		formatting?: {
			width?: number;
			textAlign?: 'left' | 'center' | 'right';
			box?: boolean | 'ellipse';
			autoResize?: boolean;
		},
	): string;
	addArrow(
		points: [number, number][],
		formatting?: {
			startArrowHead?: 'arrow' | null;
			endArrowHead?: 'arrow' | null;
			startObjectId?: string;
			endObjectId?: string;
		},
	): string;
	addToGroup?(ids: string[]): string;
	addAppendUpdateCustomData?(
		id: string,
		data: Record<string, unknown>,
	): ExcalidrawElementLike | undefined;
	getElement(id: string): ExcalidrawElementLike | undefined;
	getAPI?(view?: ExcalidrawViewLike): ExcalidrawAutomateLike;
	setView?(view?: ExcalidrawViewLike | 'active' | 'first'): ExcalidrawViewLike | undefined;
	getViewElements?(): ExcalidrawElementLike[];
	getViewSelectedElement?(): ExcalidrawElementLike | null;
	copyViewElementsToEAforEditing?(elements: ExcalidrawElementLike[], copyImages?: boolean): void;
	deleteViewElements?(elements: ExcalidrawElementLike[]): boolean;
	addElementsToView?(
		repositionToCursor?: boolean,
		save?: boolean,
		newElementsOnTop?: boolean,
		shouldRestoreElements?: boolean,
	): Promise<boolean>;
	registerThisAsViewEA?(): boolean;
	setFillStyle?(value: number): string;
	setStrokeStyle?(value: number): string;
	setStrokeSharpness?(value: number): string;
	style?: ExcalidrawStyleLike;
	targetView?: ExcalidrawViewLike;
	onLinkClickHook?: (
		element: ExcalidrawElementLike,
		linkText: string,
		event: MouseEvent,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
	) => boolean;
	onDropHook?: (data: ExcalidrawDropData) => boolean;
	onSceneChangeHook?: {
		trackElements: true;
		callback: (elements: readonly ExcalidrawElementLike[]) => void;
	} | null;
	onViewUnloadHook?: (view: ExcalidrawViewLike) => void;
	isExcalidrawFile?(file: TFile): boolean;
	create(params?: {
		filename?: string;
		foldername?: string;
		onNewPane?: boolean;
		silent?: boolean;
		plaintext?: string;
		frontmatterKeys?: {
			'excalidraw-default-mode'?: 'view' | 'zen';
		};
	}): Promise<string>;
}

declare global {
	interface Window {
		ExcalidrawAutomate?: ExcalidrawAutomateLike;
	}
}

function drawingName(prefix: string): string {
	const timestamp = new Date().toISOString().replaceAll(':', '-').replace('T', ' ').slice(0, 19);
	return `${prefix} ${timestamp}`;
}

function elementData(
	scope: KnowledgeCanvasElementData['scope'],
	role: KnowledgeCanvasElementData['role'],
	patch: Partial<KnowledgeCanvasElementData> = {},
): Record<string, unknown> {
	const definedPatch = Object.fromEntries(
		Object.entries(patch).filter((entry) => entry[1] !== undefined),
	);
	return {
		[KNOWLEDGE_CANVAS_DATA_KEY]: {
			managed: true,
			scope,
			role,
			...definedPatch,
		},
	};
}

export class ExcalidrawIntegration {
	private readonly graphBuilder: VaultGraphBuilder;
	private readonly boundViews = new WeakSet<object>();
	private readonly navigationLocks = new Set<string>();
	private readonly renderingViews = new WeakSet<object>();

	constructor(
		private readonly app: App,
		private readonly store: KnowledgeMapStore,
	) {
		this.graphBuilder = new VaultGraphBuilder(app);
	}

	get available(): boolean {
		return Boolean(window.ExcalidrawAutomate);
	}

	isDrawing(file: TFile): boolean {
		return window.ExcalidrawAutomate?.isExcalidrawFile?.(file) ?? file.path.endsWith('.excalidraw.md');
	}

	isKnowledgeCanvas(file: TFile): boolean {
		return Boolean(this.store.getKnowledgeCanvas(file.path));
	}

	async createBlank(folderPath: string): Promise<void> {
		const ea = this.requireApi();
		if (!ea) return;
		ea.reset();
		await ea.create({
			filename: drawingName('Blank canvas'),
			foldername: folderPath === ROOT_PATH ? undefined : folderPath,
			onNewPane: true,
			plaintext: 'A standard Excalidraw drawing created from Knowledge Map.',
		});
	}

	async createKnowledgeCanvas(folderPath: string): Promise<void> {
		const ea = this.requireApi();
		if (!ea) return;
		const normalizedPath = normalizeFolderPath(folderPath);
		const graph = this.graphBuilder.build(normalizedPath, this.store.settings.showExternalLinks);
		const positions = createInitialPositions(graph, this.store.getMapState(normalizedPath)?.nodes ?? {});

		ea.reset();
		this.addFolderMapToWorkbench(ea, graph, positions);
		const filePath = await ea.create({
			filename: drawingName(`${folderDisplayName(normalizedPath)} knowledge canvas`),
			foldername: normalizedPath === ROOT_PATH ? undefined : normalizedPath,
			onNewPane: true,
			plaintext: [
				'Created by Knowledge Map.',
				'Folder nodes can drill down without leaving this Excalidraw canvas.',
				'Your own Excalidraw elements are preserved when the folder map changes.',
			].join(' '),
		});
		this.store.registerKnowledgeCanvas(filePath, normalizedPath);
		await this.store.flush();
		await this.bindCreatedCanvas(filePath);
		new Notice('Knowledge canvas created. Use Excalidraw link interaction on a folder node to drill down.');
	}

	async createFromGraph(
		folderPath: string,
		_graph: FolderGraph,
		_positions: Record<string, SavedNodePosition>,
	): Promise<void> {
		await this.createKnowledgeCanvas(folderPath);
	}

	bindOpenViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(EXCALIDRAW_VIEW_TYPE)) this.bindLeaf(leaf);
	}

	bindLeaf(leaf: WorkspaceLeaf | null): boolean {
		if (!leaf) return false;
		const view = leaf.view as unknown as ExcalidrawViewLike;
		const file = view.file;
		if (view.getViewType() !== EXCALIDRAW_VIEW_TYPE || !file || !this.isKnowledgeCanvas(file)) return false;
		if (this.boundViews.has(view)) return true;

		const rootApi = this.requireApi(false);
		const ea = rootApi?.getAPI?.(view);
		if (!ea) return false;
		ea.setView?.(view);
		ea.onLinkClickHook = (element, linkText, event, hookView, hookEa) => {
			const target = parseKnowledgeCanvasLink(linkText);
			if (target) {
				void this.activateKnowledgeTarget(file, hookView, hookEa, target, false);
				return false;
			}
			const data = readKnowledgeCanvasData(element);
			if (!data?.path || data.nodeKind !== 'note' && data.nodeKind !== 'external-note') return true;
			void this.openKnowledgeNote(file, data.path, event.ctrlKey || event.metaKey);
			return false;
		};
		ea.onDropHook = (data) => {
			const dropped = this.collectDroppedItems(data);
			if (dropped.length === 0) return false;
			void this.addDroppedItems(data.ea, dropped, data.pointerPosition);
			// Excalidraw 2.26.x treats true as "handled" here and skips its native text-link drop.
			return true;
		};
		let latestElements: readonly ExcalidrawElementLike[] = [];
		let positionSaveTimer: number | null = null;
		ea.onSceneChangeHook = {
			trackElements: true,
			callback: (elements) => {
				if (this.renderingViews.has(view)) return;
				latestElements = elements;
				if (positionSaveTimer !== null) window.clearTimeout(positionSaveTimer);
				positionSaveTimer = window.setTimeout(() => {
					positionSaveTimer = null;
					this.persistCanvasPositions(file, latestElements);
				}, 150);
			},
		};
		const removeDirectClick = this.registerDirectClick(file, view, ea);
		let removeResetMenuOption = (): void => undefined;
		ea.onViewUnloadHook = (unloadedView) => {
			if (unloadedView !== view) return;
			if (positionSaveTimer !== null) window.clearTimeout(positionSaveTimer);
			this.persistCanvasPositions(file, latestElements);
			removeDirectClick();
			removeResetMenuOption();
			ea.onLinkClickHook = undefined;
			ea.onDropHook = undefined;
			ea.onSceneChangeHook = null;
		};
		const registered = ea.registerThisAsViewEA?.() ?? false;
		if (registered) {
			this.boundViews.add(view);
			removeResetMenuOption = this.registerResetMenuOption(file, view, ea);
			void this.polishManagedElements(ea);
		}
		return registered;
	}

	async refreshActiveKnowledgeCanvas(): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);
		if (!leaf) return;
		const view = leaf.view as unknown as ExcalidrawViewLike;
		const file = view.file;
		const state = file ? this.store.getKnowledgeCanvas(file.path) : undefined;
		if (!file || !state) {
			new Notice('The active tab is not a knowledge map canvas.');
			return;
		}
		const ea = this.requireApi()?.getAPI?.(view);
		if (!ea) return;
		await this.renderFolderIntoView(file, state.folderPath, view, ea, false);
		new Notice('Knowledge canvas refreshed.');
	}

	async goBackActiveKnowledgeCanvas(): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);
		if (!leaf) return;
		const view = leaf.view as unknown as ExcalidrawViewLike;
		const file = view.file;
		if (!file || !this.store.getKnowledgeCanvas(file.path)) {
			new Notice('The active tab is not a knowledge map canvas.');
			return;
		}
		const ea = this.requireApi()?.getAPI?.(view);
		if (!ea) return;
		this.persistCanvasPositions(file, ea.getViewElements?.() ?? []);
		const folderPath = this.store.goBackKnowledgeCanvas(file.path);
		if (!folderPath) {
			new Notice('There is no earlier folder in this canvas.');
			return;
		}
		await this.renderFolderIntoView(file, folderPath, view, ea, false, false, false);
	}

	async resetActiveKnowledgeCanvasLayout(): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);
		if (!leaf) return;
		const view = leaf.view as unknown as ExcalidrawViewLike;
		const file = view.file;
		const state = file ? this.store.getKnowledgeCanvas(file.path) : undefined;
		if (!file || !state) {
			new Notice('The active tab is not a knowledge map canvas.');
			return;
		}
		const ea = this.requireApi()?.getAPI?.(view);
		if (!ea) return;
		await this.restoreDefaultLayout(file, view, ea);
	}

	private async followKnowledgeLink(
		file: TFile,
		action: KnowledgeCanvasAction,
		path: string | undefined,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
	): Promise<void> {
		if (action === 'back') {
			this.persistCanvasPositions(file, ea.getViewElements?.() ?? []);
			const previous = this.store.goBackKnowledgeCanvas(file.path);
			if (!previous) {
				new Notice('There is no earlier folder in this canvas.');
				return;
			}
			await this.renderFolderIntoView(file, previous, view, ea, false, false, false);
			return;
		}
		if (action === 'reset') {
			await this.restoreDefaultLayout(file, view, ea);
			return;
		}
		const folderPath = action === 'root' ? ROOT_PATH : path;
		if (!folderPath) return;
		await this.renderFolderIntoView(file, folderPath, view, ea, true);
	}

	private registerDirectClick(
		file: TFile,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
	): () => void {
		const container = view.containerEl;
		if (!container || !ea.getViewSelectedElement) return () => undefined;
		let start: { x: number; y: number; time: number } | null = null;
		const onPointerDown = (event: PointerEvent): void => {
			if (event.button !== 0) return;
			start = { x: event.clientX, y: event.clientY, time: Date.now() };
		};
		const onPointerUp = (event: PointerEvent): void => {
			if (!start || event.button !== 0) return;
			const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
			const elapsed = Date.now() - start.time;
			start = null;
			if (distance > 5 || elapsed > 600) return;
			const openInNewLeaf = event.ctrlKey || event.metaKey;
			window.setTimeout(() => {
				const element = ea.getViewSelectedElement?.();
				if (!element) return;
				const data = readKnowledgeCanvasData(element);
				if (!data) return;
				if (data.action === 'folder' && data.path) {
					void this.activateKnowledgeTarget(
						file,
						view,
						ea,
						{ action: 'folder', path: data.path },
						openInNewLeaf,
					);
					return;
				}
				if (data.action === 'back' || data.action === 'reset' || data.action === 'root') {
					void this.activateKnowledgeTarget(file, view, ea, { action: data.action }, false);
					return;
				}
				if (data.path && (data.nodeKind === 'note' || data.nodeKind === 'external-note')) {
					void this.openKnowledgeNote(file, data.path, openInNewLeaf);
				}
			}, 0);
		};
		container.addEventListener('pointerdown', onPointerDown, true);
		container.addEventListener('pointerup', onPointerUp, true);
		return () => {
			container.removeEventListener('pointerdown', onPointerDown, true);
			container.removeEventListener('pointerup', onPointerUp, true);
		};
	}

	private registerResetMenuOption(
		file: TFile,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
	): () => void {
		const container = view.containerEl;
		if (!container) return () => undefined;
		const viewWindow = container.ownerDocument.defaultView ?? window;
		const document = container.ownerDocument;
		let disposed = false;
		let animationFrame: number | null = null;
		const insertIntoOpenMenu = (): void => {
			animationFrame = null;
			if (disposed) return;
			const containerRect = container.getBoundingClientRect();
			const visible = containerRect.width > 0
				&& containerRect.height > 0
				&& container.getClientRects().length > 0;
			if (!visible) return;

			const menus = Array.from(document.querySelectorAll<HTMLElement>('.excalidraw .dropdown-menu'))
				.filter((menu) => {
					const rect = menu.getBoundingClientRect();
					return rect.width > 120
						&& rect.height > 80
						&& rect.left >= containerRect.left
						&& rect.right <= containerRect.right
						&& rect.top >= containerRect.top
						&& rect.top < containerRect.top + 320;
				});
			for (const menu of menus) {
				const menuContainer = menu.querySelector<HTMLElement>('.dropdown-menu-container') ?? menu;
				if (menuContainer.querySelector('.knowledge-map-excalidraw-reset-menu')) continue;
				const group = menuContainer.createDiv({
					cls: 'knowledge-map-excalidraw-reset-menu',
				});
				const item = group.createEl('button', {
					cls: 'dropdown-menu-item',
				});
				item.type = 'button';
				item.setAttribute('aria-label', 'Reset knowledge layout');
				const text = item.createSpan({ cls: 'dropdown-menu-item__text' });
				const icon = text.createSpan({ cls: 'knowledge-map-excalidraw-reset-menu__icon' });
				setIcon(icon, 'rotate-ccw');
				text.createSpan({ text: 'Reset knowledge layout' });
				item.addEventListener('pointerdown', (event) => event.stopPropagation());
				item.addEventListener('click', (event) => {
					event.preventDefault();
					event.stopPropagation();
					void this.activateKnowledgeTarget(file, view, ea, { action: 'reset' }, false);
				});
			}
		};
		const scheduleInsertion = (): void => {
			if (animationFrame !== null) return;
			animationFrame = viewWindow.requestAnimationFrame(insertIntoOpenMenu);
		};

		const Observer = container.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(scheduleInsertion);
		observer.observe(container, { childList: true, subtree: true });
		const interval = viewWindow.setInterval(scheduleInsertion, 250);
		scheduleInsertion();

		return () => {
			disposed = true;
			observer.disconnect();
			viewWindow.clearInterval(interval);
			if (animationFrame !== null) viewWindow.cancelAnimationFrame(animationFrame);
			document.querySelectorAll('.knowledge-map-excalidraw-reset-menu')
				.forEach((element) => element.remove());
		};
	}

	private async restoreDefaultLayout(
		file: TFile,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
	): Promise<void> {
		const state = this.store.getKnowledgeCanvas(file.path);
		if (!state) return;
		await this.renderFolderIntoView(file, state.folderPath, view, ea, false, true, false);
		new Notice('Current folder layout restored to its default positions.');
	}

	private async activateKnowledgeTarget(
		file: TFile,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
		target: { action: KnowledgeCanvasAction; path?: string },
		_openInNewLeaf: boolean,
	): Promise<void> {
		const key = `canvas:${file.path}`;
		if (this.navigationLocks.has(key)) return;
		this.navigationLocks.add(key);
		try {
			await this.followKnowledgeLink(file, target.action, target.path, view, ea);
		} finally {
			window.setTimeout(() => this.navigationLocks.delete(key), 200);
		}
	}

	private async openKnowledgeNote(sourceFile: TFile, notePath: string, newLeaf: boolean): Promise<void> {
		const key = `note:${sourceFile.path}:${notePath}`;
		if (this.navigationLocks.has(key)) return;
		this.navigationLocks.add(key);
		try {
			await this.app.workspace.openLinkText(notePath, sourceFile.path, newLeaf);
		} finally {
			window.setTimeout(() => this.navigationLocks.delete(key), 200);
		}
	}

	private async renderFolderIntoView(
		file: TFile,
		folderPath: string,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
		addToHistory: boolean,
		resetLayout = false,
		captureCurrent = true,
	): Promise<void> {
		if (captureCurrent) this.persistCanvasPositions(file, ea.getViewElements?.() ?? []);
		const normalizedPath = normalizeFolderPath(folderPath);
		const abstractFile = this.resolvePath(normalizedPath);
		if (!(abstractFile instanceof TFolder)) {
			new Notice(`Folder not found: ${normalizedPath}`);
			return;
		}
		this.renderingViews.add(view);
		try {
			if (resetLayout) this.store.resetKnowledgeCanvasLayout(file.path, normalizedPath);
			ea.setView?.(view);
			const generated = ea.getViewElements?.().filter((element) => {
				return readKnowledgeCanvasData(element)?.scope === 'map';
			}) ?? [];
			if (generated.length > 0) ea.deleteViewElements?.(generated);

			const graph = this.graphBuilder.build(normalizedPath, this.store.settings.showExternalLinks);
			const sharedPositions = resetLayout ? {} : this.store.getMapState(normalizedPath)?.nodes ?? {};
			const canvasPositions = resetLayout
				? {}
				: this.store.getKnowledgeCanvasPositions(file.path, normalizedPath);
			const positions = createInitialPositions(graph, { ...sharedPositions, ...canvasPositions });
			ea.reset();
			this.addFolderMapToWorkbench(ea, graph, positions);
			const added = await ea.addElementsToView?.(false, true, true);
			if (added === false) {
				new Notice('Could not update the knowledge map elements in Excalidraw.');
				return;
			}
			this.store.openKnowledgeCanvasFolder(file.path, normalizedPath, addToHistory);
			await this.store.flush();
		} finally {
			this.renderingViews.delete(view);
		}
	}

	private persistCanvasPositions(
		file: TFile,
		elements: readonly ExcalidrawElementLike[],
	): void {
		const state = this.store.getKnowledgeCanvas(file.path);
		if (!state) return;
		const positions: Record<string, SavedNodePosition> = {};
		for (const element of elements) {
			const data = readKnowledgeCanvasData(element);
			if (
				data?.scope !== 'map'
				|| data.role !== 'node'
				|| !data.nodeKind
				|| !data.path
				|| element.isDeleted
				|| element.x === undefined
				|| element.y === undefined
				|| element.width === undefined
				|| element.height === undefined
			) continue;
			positions[`${data.nodeKind}:${data.path}`] = {
				x: (element.x + element.width / 2) / NODE_SCALE,
				y: (element.y + element.height / 2) / NODE_SCALE,
				fixed: true,
			};
		}
		if (Object.keys(positions).length > 0) {
			this.store.setKnowledgeCanvasPositions(file.path, state.folderPath, positions);
		}
	}

	private addFolderMapToWorkbench(
		ea: ExcalidrawAutomateLike,
		graph: FolderGraph,
		positions: Record<string, SavedNodePosition>,
	): void {
		this.addHeader(ea, graph.folderPath);
		this.addNavigation(ea, graph.folderPath);
		const elementIds = new Map<string, string>();

		for (const node of graph.nodes) {
			const point = positions[node.id];
			if (!point) continue;
			const nodeIds = this.addNode(ea, node, point.x * NODE_SCALE, point.y * NODE_SCALE, 'map');
			elementIds.set(node.id, nodeIds.shapeId);
		}

		for (const edge of graph.edges) {
			const from = positions[edge.from];
			const to = positions[edge.to];
			const fromId = elementIds.get(edge.from);
			const toId = elementIds.get(edge.to);
			if (!from || !to || !fromId || !toId) continue;
			this.addEdge(ea, edge, from, to, fromId, toId);
		}
	}

	private addHeader(ea: ExcalidrawAutomateLike, folderPath: string): void {
		this.setTextStyle(ea, '#3f3a34', 22);
		const breadcrumb = folderPath === ROOT_PATH ? 'Knowledge Map' : `Knowledge Map  /  ${folderPath}`;
		const id = ea.addText(-360, -390, breadcrumb, { width: 720, textAlign: 'center' });
		this.tag(ea, id, elementData('map', 'header', { path: folderPath }));
	}

	private addNavigation(ea: ExcalidrawAutomateLike, folderPath: string): void {
		if (folderPath === ROOT_PATH) return;
		this.addNavigationChip(ea, -118, -330, 108, 'Back', 'back');
		this.addNavigationChip(ea, 10, -330, 108, 'Root', 'root');
	}

	private addNavigationChip(
		ea: ExcalidrawAutomateLike,
		x: number,
		y: number,
		width: number,
		label: string,
		action: KnowledgeCanvasAction,
	): void {
		this.setShapeStyle(ea, '#81766a', '#f5f0e8', 1.5, 0);
		const shapeId = ea.addRect?.(x, y, width, 42) ?? ea.addEllipse(x, y, width, 42);
		this.tag(ea, shapeId, elementData('map', 'navigation', { action }));
		this.setTextStyle(ea, '#514b44', 16);
		const textId = ea.addText(x, y + 11, label, { width, textAlign: 'center' });
		this.tag(ea, textId, elementData('map', 'navigation', { action }));
		ea.addToGroup?.([shapeId, textId]);
	}

	private addNode(
		ea: ExcalidrawAutomateLike,
		node: MapNode,
		centerX: number,
		centerY: number,
		scope: KnowledgeCanvasElementData['scope'],
	): { shapeId: string; textId: string } {
		const isFolder = node.kind === 'folder' || node.kind === 'current-folder';
		const size = isFolder ? FOLDER_SIZE : NOTE_SIZE;
		const x = centerX - size / 2;
		const y = centerY - size / 2;
		const isCurrent = node.kind === 'current-folder';
		this.setShapeStyle(
			ea,
			this.nodeStrokeColor(node.kind),
			this.nodeBackgroundColor(node.kind),
			isCurrent ? 2.4 : 2,
			0,
		);
		const shapeId = ea.addEllipse(x, y, size, size);
		const data = elementData(scope, 'node', {
			nodeKind: node.kind,
			path: node.path,
			action: node.kind === 'folder' ? 'folder' : undefined,
		});
		this.tag(ea, shapeId, data);

		this.setTextStyle(ea, this.nodeTextColor(node.kind), isFolder ? 17 : 15);
		const textId = ea.addText(x, y + size / 2 - 11, node.label, {
			width: size,
			textAlign: 'center',
			autoResize: false,
		});
		this.tag(ea, textId, elementData(scope, 'label', {
			nodeKind: node.kind,
			path: node.path,
			action: node.kind === 'folder' ? 'folder' : undefined,
		}));
		ea.addToGroup?.([shapeId, textId]);
		return { shapeId, textId };
	}

	private addEdge(
		ea: ExcalidrawAutomateLike,
		edge: MapEdge,
		from: SavedNodePosition,
		to: SavedNodePosition,
		fromId: string,
		toId: string,
	): void {
		const containment = edge.kind === 'containment';
		this.setShapeStyle(ea, containment ? '#c47a2c' : '#5b8fc9', 'transparent', containment ? 2.25 : 1.75, containment ? 0 : 1);
		const start: [number, number] = [from.x * NODE_SCALE, from.y * NODE_SCALE];
		const end: [number, number] = [to.x * NODE_SCALE, to.y * NODE_SCALE];
		const control = this.edgeControlPoint(edge, start, end);
		const edgeId = ea.addArrow([start, control, end], {
			startArrowHead: null,
			endArrowHead: containment ? 'arrow' : null,
			startObjectId: fromId,
			endObjectId: toId,
		});
		this.tag(ea, edgeId, elementData('map', 'edge', { edgeKind: edge.kind }));
	}

	private edgeControlPoint(
		edge: MapEdge,
		start: [number, number],
		end: [number, number],
	): [number, number] {
		const deltaX = end[0] - start[0];
		const deltaY = end[1] - start[1];
		const distance = Math.max(1, Math.hypot(deltaX, deltaY));
		const middleX = (start[0] + end[0]) / 2;
		const middleY = (start[1] + end[1]) / 2;
		const bend = Math.min(edge.kind === 'containment' ? 42 : 58, Math.max(18, distance * 0.1));
		let direction: number;
		if (edge.kind === 'containment' && Math.abs(deltaX) > 8) {
			// Fan hierarchy links gently away from the center instead of crossing each other.
			direction = deltaX < 0 ? 1 : -1;
		} else {
			let hash = 0;
			for (const character of edge.id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
			direction = (hash & 1) === 0 ? 1 : -1;
		}
		return [
			middleX - deltaY / distance * bend * direction,
			middleY + deltaX / distance * bend * direction,
		];
	}

	private collectDroppedItems(data: ExcalidrawDropData): TAbstractFile[] {
		const items = new Map<string, TAbstractFile>();
		for (const file of data.payload.files ?? []) this.addDropCandidate(items, file);
		this.addNestedDropCandidates(items, data.draggable, 0, new WeakSet<object>());
		this.addDropText(items, data.payload.text, data.excalidrawFile.path);

		const transfer = data.event?.dataTransfer ?? data.event?.nativeEvent?.dataTransfer;
		if (transfer) {
			const types = new Set<string>([
				'text/plain',
				'text/uri-list',
				'application/json',
				...(transfer.types ?? []),
			]);
			for (const type of types) {
				let value = '';
				try {
					value = transfer.getData(type);
				} catch {
					continue;
				}
				this.addDropText(items, value, data.excalidrawFile.path);
			}
		}
		return [...items.values()];
	}

	private addNestedDropCandidates(
		items: Map<string, TAbstractFile>,
		candidate: unknown,
		depth: number,
		seen: WeakSet<object>,
	): void {
		if (depth > 4 || candidate === null || candidate === undefined) return;
		this.addDropCandidate(items, candidate);
		if (typeof candidate !== 'object') return;
		if (seen.has(candidate)) return;
		seen.add(candidate);
		if (Array.isArray(candidate)) {
			for (const child of candidate) this.addNestedDropCandidates(items, child, depth + 1, seen);
			return;
		}
		const record = candidate as Record<string, unknown>;
		for (const key of ['file', 'files', 'folder', 'folders', 'item', 'items', 'path', 'paths', 'sourcePath']) {
			this.addNestedDropCandidates(items, record[key], depth + 1, seen);
		}
	}

	private addDropText(
		items: Map<string, TAbstractFile>,
		rawText: string | null | undefined,
		sourcePath: string,
	): void {
		const text = rawText?.trim() ?? '';
		if (!text) return;
		try {
			const parsed = JSON.parse(text) as unknown;
			this.addNestedDropCandidates(items, parsed, 0, new WeakSet<object>());
		} catch {
			// Most Obsidian drag payloads are links or paths rather than JSON.
		}

		for (const match of text.matchAll(/!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?]]/g)) {
			this.addDropLinkText(items, match[1] ?? '', sourcePath);
		}
		for (const match of text.matchAll(/\[[^\]]*]\(([^)]+)\)/g)) {
			this.addDropLinkText(items, match[1] ?? '', sourcePath);
		}
		for (const line of text.split(/\r?\n/)) this.addDropLinkText(items, line, sourcePath);
	}

	private addDropLinkText(
		items: Map<string, TAbstractFile>,
		candidateText: string,
		sourcePath: string,
	): void {
		let candidate = candidateText.trim().replace(/^<|>$/g, '');
		if (!candidate) return;
		try {
			if (candidate.startsWith('obsidian://')) {
				const url = new URL(candidate);
				candidate = url.searchParams.get('file') ?? url.searchParams.get('path') ?? '';
			}
			candidate = decodeURIComponent(candidate);
		} catch {
			// Keep the original value when it is not a URL-encoded path.
		}
		candidate = candidate
			.replace(/^file:\/\//, '')
			.replace(/^\[\[|]]$/g, '')
			.replace(/^\/+|\/+$/g, '')
			.trim();
		if (!candidate) return;

		const direct = this.resolvePath(candidate);
		if (direct) {
			this.addDropCandidate(items, direct);
			return;
		}
		const linkedFile = this.app.metadataCache.getFirstLinkpathDest(candidate, sourcePath);
		if (linkedFile) {
			this.addDropCandidate(items, linkedFile);
			return;
		}
		const folderMatches = this.app.vault.getAllLoadedFiles().filter((file) => {
			return file instanceof TFolder && (file.name === candidate || file.path.endsWith(`/${candidate}`));
		});
		if (folderMatches.length === 1) this.addDropCandidate(items, folderMatches[0]);
	}

	private addDropCandidate(items: Map<string, TAbstractFile>, candidate: unknown): void {
		let abstractFile: TAbstractFile | null = null;
		if (candidate instanceof TAbstractFile) abstractFile = candidate;
		else if (typeof candidate === 'string') abstractFile = this.resolvePath(candidate);
		else if (candidate && typeof candidate === 'object' && 'path' in candidate) {
			const path = (candidate as { path?: unknown }).path;
			if (typeof path === 'string') abstractFile = this.resolvePath(path);
		}
		if (abstractFile instanceof TFolder || abstractFile instanceof TFile && abstractFile.extension === 'md') {
			items.set(abstractFile.path, abstractFile);
		}
	}

	private async addDroppedItems(
		ea: ExcalidrawAutomateLike,
		items: TAbstractFile[],
		pointer: { x: number; y: number },
	): Promise<void> {
		ea.reset();
		items.forEach((item, index) => {
			const isFolder = item instanceof TFolder;
			const label = item instanceof TFile ? item.basename : item.name;
			const node: MapNode = {
				id: `${isFolder ? 'folder' : 'note'}:${item.path}`,
				kind: isFolder ? 'folder' : 'note',
				path: item.path,
				label,
			};
			const column = index % 4;
			const row = Math.floor(index / 4);
			this.addNode(ea, node, pointer.x + column * 140, pointer.y + row * 140, 'manual');
		});
		const added = await ea.addElementsToView?.(false, true, true);
		if (added === false) new Notice('Could not add the dropped vault items to Excalidraw.');
	}

	private async polishManagedElements(ea: ExcalidrawAutomateLike): Promise<void> {
		if (!ea.getViewElements || !ea.copyViewElementsToEAforEditing || !ea.addElementsToView) return;
		const allElements = ea.getViewElements();
		const obsoleteResetElements = allElements.filter((element) => {
			const data = readKnowledgeCanvasData(element);
			return data?.role === 'navigation' && data.action === 'reset';
		});
		if (obsoleteResetElements.length > 0) ea.deleteViewElements?.(obsoleteResetElements);
		const managedElements = allElements.filter((element) => {
			const data = readKnowledgeCanvasData(element);
			return Boolean(data) && !(data?.role === 'navigation' && data.action === 'reset');
		});
		if (managedElements.length === 0) return;
		ea.reset();
		ea.copyViewElementsToEAforEditing(managedElements, false);
		for (const element of managedElements) {
			const editable = ea.getElement(element.id);
			const data = readKnowledgeCanvasData(element);
			if (!editable || !data) continue;
			editable.link = null;
			if (data.role === 'node' && data.nodeKind) {
				Object.assign(editable, {
					strokeColor: this.nodeStrokeColor(data.nodeKind),
					backgroundColor: this.nodeBackgroundColor(data.nodeKind),
					strokeWidth: data.nodeKind === 'current-folder' ? 2.4 : 2,
					strokeStyle: 'solid',
					fillStyle: 'solid',
					roughness: 0,
					opacity: 100,
				});
			} else if (data.role === 'label' && data.nodeKind) {
				Object.assign(editable, {
					strokeColor: this.nodeTextColor(data.nodeKind),
					backgroundColor: 'transparent',
					roughness: 0,
					opacity: 100,
				});
			}
		}
		await ea.addElementsToView(false, true, false);
	}

	private nodeStrokeColor(kind: MapNode['kind']): string {
		switch (kind) {
			case 'current-folder': return '#9a6b35';
			case 'folder': return '#c77d2f';
			case 'external-note': return '#8274a6';
			case 'note': return '#5c82aa';
		}
	}

	private nodeBackgroundColor(kind: MapNode['kind']): string {
		switch (kind) {
			case 'current-folder': return '#f5ead8';
			case 'folder': return '#fff3d8';
			case 'external-note': return '#f2eef8';
			case 'note': return '#edf5fc';
		}
	}

	private nodeTextColor(kind: MapNode['kind']): string {
		switch (kind) {
			case 'current-folder':
			case 'folder': return '#4d4032';
			case 'external-note': return '#4e465f';
			case 'note': return '#34485c';
		}
	}

	private setShapeStyle(
		ea: ExcalidrawAutomateLike,
		strokeColor: string,
		backgroundColor: string,
		strokeWidth: number,
		strokeStyle: number,
	): void {
		if (!ea.style) return;
		Object.assign(ea.style, { strokeColor, backgroundColor, strokeWidth, roughness: 0, opacity: 100 });
		ea.setFillStyle?.(2);
		ea.setStrokeStyle?.(strokeStyle);
		ea.setStrokeSharpness?.(0);
	}

	private setTextStyle(ea: ExcalidrawAutomateLike, color: string, fontSize: number): void {
		if (!ea.style) return;
		Object.assign(ea.style, { strokeColor: color, backgroundColor: 'transparent', fontSize });
	}

	private tag(ea: ExcalidrawAutomateLike, id: string, data: Record<string, unknown>): void {
		if (ea.addAppendUpdateCustomData) {
			ea.addAppendUpdateCustomData(id, data);
			return;
		}
		const element = ea.getElement(id);
		if (element) element.customData = { ...(element.customData ?? {}), ...data };
	}

	private resolvePath(path: string): TAbstractFile | null {
		const normalized = normalizeFolderPath(path);
		return normalized === ROOT_PATH
			? this.app.vault.getRoot()
			: this.app.vault.getAbstractFileByPath(normalized);
	}

	private async bindCreatedCanvas(filePath: string): Promise<void> {
		for (let attempt = 0; attempt < 20; attempt += 1) {
			const leaf = this.app.workspace.getLeavesOfType(EXCALIDRAW_VIEW_TYPE).find((candidate) => {
				const view = candidate.view as unknown as ExcalidrawViewLike;
				return view.file?.path === filePath;
			});
			if (leaf && this.bindLeaf(leaf)) return;
			await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
		}
	}

	private requireApi(showNotice = true): ExcalidrawAutomateLike | null {
		const api = window.ExcalidrawAutomate;
		if (api) return api;
		if (showNotice) new Notice('Install and enable the Excalidraw plugin to use freeform canvases.');
		return null;
	}
}
