# Excalidraw knowledge canvas

A knowledge canvas is a normal Excalidraw drawing with a generated Knowledge Map layer. It combines two jobs in one tab:

- Knowledge Map supplies folder and note nodes from the real Obsidian vault.
- Excalidraw supplies text, icons, shapes, free drawing, images, grouping, export, and its normal editing tools.

Knowledge Map does not copy or modify the Excalidraw plugin. Excalidraw must be installed and enabled separately.

## Create a canvas

1. Open **Manage knowledge canvases** from the left ribbon or command palette.
2. Choose **Knowledge canvas**. When opened from a folder map, that folder is used; from the global command, the vault root is used.
3. The new Excalidraw file opens with an orderly generated folder map.

Choose **Plain Excalidraw canvas** when no automatic knowledge nodes are wanted.

## Understand the elements

- Orange circles are folders. Click one to replace the generated layer with that folder's map.
- Blue circles are Markdown notes. Click one to open the real note.
- **Back** returns to the previous folder visited in this canvas.
- **Root** returns to the vault root.
- **Reset knowledge layout** in Excalidraw's three-dot tool menu restores the current folder's generated nodes and connections to their orderly default positions. It is a menu option, so it does not move or scale with the drawing.
- Gently curved warm solid arrows show folder containment; gently curved blue dashed lines show note references.

Knowledge nodes distinguish a click from a drag: a short click opens or drills down, while moving the pointer continues to drag the Excalidraw element. Navigation is stored in Knowledge Map metadata, so the circles do not need Excalidraw's separate link-indicator icon.

Knowledge nodes use clean solid borders and quiet paper-like fills rather than Excalidraw's sketch-style dashed outlines. Folder, note, current-folder, and external-note colors remain distinct without becoming overly saturated. Existing managed nodes are restyled when their knowledge canvas is opened after the plugin reloads.

## Add your own content

Use every normal Excalidraw tool as usual. You can also drag a Markdown file or folder from Obsidian's file explorer onto the canvas:

- a Markdown file becomes a linked note node;
- a folder becomes a drillable folder node;
- multiple dropped items are arranged in a small grid at the drop position.

Manually dropped nodes and ordinary Excalidraw elements are not removed when you drill into another folder or refresh the generated layer.

Generated node positions are saved separately for every folder in every knowledge canvas. Moving nodes, drilling elsewhere, returning, refreshing, or reopening the drawing restores that canvas's saved layout instead of reverting to the automatic row.

Curved Excalidraw connections contain a bend point as well as two bound endpoints. If repeated manual dragging makes a bend untidy, use **Reset knowledge layout** in the three-dot tool menu to rebuild the current generated layer; manually added canvas content remains in place.

## Commands

- **Knowledge Map: Create knowledge canvas**
- **Knowledge Map: Refresh active knowledge canvas**
- **Knowledge Map: Go back in active knowledge canvas**
- **Knowledge Map: Restore default layout in active knowledge canvas**
- **Knowledge Map: Create plain Excalidraw canvas**

## Storage and safety

The drawing remains an ordinary `.excalidraw.md` file. Knowledge Map stores only its current folder and navigation history in plugin data. It marks generated elements with Excalidraw custom data so refresh and drill-down can distinguish them from the user's own drawing elements.

The extra menu option is injected only while a registered knowledge canvas is open. Ordinary Excalidraw drawings are not changed, and the Excalidraw plugin's files are never modified.
