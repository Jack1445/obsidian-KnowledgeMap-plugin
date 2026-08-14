# Core concepts and interactions

## Folder map

A folder map is generated from one real vault folder. It contains the current folder node, direct child folders, direct Markdown notes, and optionally linked notes outside the folder.

## Node types

- **Current folder:** the stable center of the map.
- **Parent folder:** a compact `..` node that returns one level up.
- **Folder:** drills into that folder.
- **Note:** opens the Markdown file.
- **External note:** a dimmed note linked from the current folder but stored elsewhere.

## Links

Edges come from `MetadataCache.resolvedLinks`. They represent real internal links. Knowledge Map never interprets them as hierarchy unless a future explicit semantic rule says otherwise.

## Persistent positions

New nodes receive deterministic initial coordinates and a small force-layout pass. Existing nodes use saved coordinates. Dragging a node marks it fixed and saves its position after the gesture ends. Resetting a folder layout is the only normal action that intentionally discards those positions.

## Canvas types

- **Automatic folder map:** live graph generated from the vault. Node size and link thickness can be adjusted in its toolbar.
- **Blank canvas:** a native Excalidraw drawing. It requires the separate Excalidraw plugin and supports the full original drawing interface.
- **Map canvas:** a native Excalidraw drawing pre-populated from the visible automatic folder map.
- **Globe canvas:** an interactive Three.js globe using the same current-folder graph and separately saved latitude/longitude.
