import { Notice, Plugin, type WorkspaceLeaf } from 'obsidian';
import { KnowledgeMapStore } from './data/store';
import { ExcalidrawIntegration } from './integrations/excalidraw';
import { KnowledgeMapSettingTab } from './settings/settings-tab';
import { KNOWLEDGE_MAP_GLOBE_VIEW_TYPE, GlobeView } from './views/globe-view';
import { KNOWLEDGE_MAP_VIEW_TYPE, KnowledgeMapView } from './views/knowledge-map-view';
import { CanvasManagerModal } from './ui/canvas-manager-modal';

export default class KnowledgeMapPlugin extends Plugin {
	store!: KnowledgeMapStore;
	readonly excalidraw = new ExcalidrawIntegration();

	async onload(): Promise<void> {
		this.store = new KnowledgeMapStore(this);
		await this.store.load();

		this.registerView(KNOWLEDGE_MAP_VIEW_TYPE, (leaf) => new KnowledgeMapView(leaf, this));
		this.registerView(KNOWLEDGE_MAP_GLOBE_VIEW_TYPE, (leaf) => new GlobeView(leaf, this));
		this.addRibbonIcon('network', 'Open knowledge map', () => void this.activateView());
		this.addCommand({
			id: 'open-map',
			name: 'Open map',
			callback: () => void this.activateView(),
		});
		this.addCommand({
			id: 'new-blank-canvas',
			name: 'New blank canvas',
			callback: () => void this.excalidraw.createBlank('/'),
		});
		this.addCommand({
			id: 'open-globe',
			name: 'Open globe',
			callback: () => void this.activateGlobe('/'),
		});
		this.addCommand({
			id: 'manage-canvases',
			name: 'Manage canvases',
			callback: () => new CanvasManagerModal(this, '/', null, null).open(),
		});
		this.addSettingTab(new KnowledgeMapSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => this.registerVaultEvents());
	}

	async activateGlobe(folderPath: string): Promise<void> {
		await this.activateGlobeView(folderPath);
	}

	async activateView(folderPath = '/'): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(KNOWLEDGE_MAP_VIEW_TYPE)[0];
		let leaf: WorkspaceLeaf;
		if (existing) {
			leaf = existing;
		} else {
			leaf = this.app.workspace.getLeaf('tab');
			await leaf.setViewState({ type: KNOWLEDGE_MAP_VIEW_TYPE, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
		if (leaf.view instanceof KnowledgeMapView) leaf.view.openFolder(folderPath);
		else new Notice('Could not open knowledge map.');
	}

	onunload(): void {
		void this.store.flush();
	}

	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(KNOWLEDGE_MAP_VIEW_TYPE)) {
			if (leaf.view instanceof KnowledgeMapView) leaf.view.refresh();
		}
	}

	private registerVaultEvents(): void {
		this.registerEvent(this.app.vault.on('create', () => this.refreshViews()));
		this.registerEvent(this.app.vault.on('modify', () => this.refreshViews()));
		this.registerEvent(this.app.vault.on('delete', (file) => {
			this.store.removePath(file.path);
			this.refreshViews();
		}));
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
			this.store.migratePath(oldPath, file.path);
			for (const leaf of this.app.workspace.getLeavesOfType(KNOWLEDGE_MAP_VIEW_TYPE)) {
				if (leaf.view instanceof KnowledgeMapView) leaf.view.handlePathRename(oldPath, file.path);
			}
		}));
		this.registerEvent(this.app.metadataCache.on('changed', () => this.refreshViews()));
		this.registerEvent(this.app.metadataCache.on('resolved', () => this.refreshViews()));
	}

	private async activateGlobeView(folderPath: string): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(KNOWLEDGE_MAP_GLOBE_VIEW_TYPE)[0];
		let leaf: WorkspaceLeaf;
		if (existing) {
			leaf = existing;
		} else {
			leaf = this.app.workspace.getLeaf('tab');
			await leaf.setViewState({ type: KNOWLEDGE_MAP_GLOBE_VIEW_TYPE, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
		if (leaf.view instanceof GlobeView) leaf.view.openFolder(folderPath);
		else new Notice('Could not open knowledge globe.');
	}
}
