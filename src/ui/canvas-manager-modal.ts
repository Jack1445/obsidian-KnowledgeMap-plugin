import { Modal, Setting, TFile } from 'obsidian';
import type KnowledgeMapPlugin from '../main';
import type { FolderGraph, SavedNodePosition } from '../core/graph';

export class CanvasManagerModal extends Modal {
	constructor(
		private readonly plugin: KnowledgeMapPlugin,
		private readonly folderPath: string,
		private readonly graph: FolderGraph | null,
		private readonly positions: Record<string, SavedNodePosition> | null,
	) {
		super(plugin.app);
	}

	onOpen(): void {
		this.titleEl.setText('Knowledge canvases');
		this.contentEl.createEl('p', {
			cls: 'setting-item-description',
			text: 'Create a freeform Excalidraw canvas, export the current folder map, or open the 3d globe.',
		});

		new Setting(this.contentEl)
			.setName('Blank canvas')
			.setDesc('Open a standard Excalidraw canvas for text, icons, shapes, drawing, and file drag-and-drop.')
			.addButton((button) => button.setButtonText('Create').setCta().onClick(() => {
				this.close();
				void this.plugin.excalidraw.createBlank(this.folderPath);
			}));

		new Setting(this.contentEl)
			.setName('Current folder map canvas')
			.setDesc('Create a standard Excalidraw drawing pre-populated with the visible folders, notes, and links.')
			.addButton((button) => button
				.setButtonText('Create')
				.setDisabled(!this.graph || !this.positions)
				.onClick(() => {
					if (!this.graph || !this.positions) return;
					this.close();
					void this.plugin.excalidraw.createFromGraph(this.folderPath, this.graph, this.positions);
				}));

		new Setting(this.contentEl)
			.setName('Globe canvas')
			.setDesc('Place this folder鈥檚 nodes on an interactive 3d globe. Drag a label to save its geographic position.')
			.addButton((button) => button.setButtonText('Open').onClick(() => {
				this.close();
				void this.plugin.activateGlobe(this.folderPath);
			}));

		this.contentEl.createEl('h3', { text: 'Existing Excalidraw canvases' });
		const drawings = this.app.vault.getFiles()
			.filter((file) => this.plugin.excalidraw.isDrawing(file))
			.sort((left, right) => right.stat.mtime - left.stat.mtime);
		if (drawings.length === 0) {
			this.contentEl.createEl('p', {
				cls: 'setting-item-description',
				text: 'No Excalidraw canvases were found in this vault.',
			});
			return;
		}
		const list = this.contentEl.createDiv({ cls: 'knowledge-map-canvas-list' });
		for (const file of drawings) this.addDrawing(list, file);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private addDrawing(parent: HTMLElement, file: TFile): void {
		const button = parent.createEl('button', { cls: 'knowledge-map-canvas-list__item' });
		button.createSpan({ cls: 'knowledge-map-canvas-list__name', text: file.basename });
		button.createSpan({ cls: 'knowledge-map-canvas-list__path', text: file.parent?.path ?? '/' });
		button.addEventListener('click', () => {
			this.close();
			void this.app.workspace.openLinkText(file.path, this.folderPath, false);
		});
	}
}

