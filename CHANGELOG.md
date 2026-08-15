# Changelog

All notable changes to Knowledge Map are documented here. Each tested GitHub checkpoint includes a short user-facing summary.

## 0.1.0 - Unreleased

### Added

- Initial Obsidian plugin project and documentation.
- Folder-aware 2D knowledge map.
- Folder drill-down, breadcrumbs, and navigation history.
- Persistent node coordinates and viewport per folder.
- Resolved note-link edges and optional external-link nodes.
- Live refresh for vault and metadata changes.
- Reliable click-versus-drag handling for folder drill-down and note opening.
- Removed the visible Vault root node.
- Added in-canvas node-size and link-thickness controls.
- Added canvas management for blank and graph-seeded native Excalidraw drawings.
- Added a lazy-loaded 3D globe with local Earth/cloud textures and persistent geographic node positions.

### Changed — folder hierarchy and canvas entry points

- Removed the synthetic `..` parent-folder node; toolbar history and breadcrumbs handle upward navigation.
- Replaced scattered automatic placement with a stable hierarchy layout: current folder above, naturally sorted direct children below.
- Added containment edges from the current folder to every direct child folder and note.
- Added separate ribbon icons and clearer command-palette actions for the 2D map, globe, and canvas manager.
- Added visible **Globe** and **Canvases** buttons to the 2D map toolbar.
- Made 2D/globe entry actions focus an already-open target tab instead of only updating it in the background.
- Preserved positions for nodes the user has manually dragged and fixed.
- Added safe visual truncation and full-name tooltips so long labels do not overlap in the ordered row.

### Changed — relationship lines

- Replaced straight SVG lines with smooth curves that update live while nodes are dragged.
- Styled folder-containment relationships as solid warm-orange curves.
- Styled note-reference relationships as dashed blue arcs so hierarchy and links remain visually distinct.
- Added a compact, context-aware legend that only shows relationship types present in the current map.
