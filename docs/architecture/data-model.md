# Data and persistence

## Derived graph data

`FolderGraph` is rebuilt from the vault when a map renders. It is not saved as a duplicate database.

```ts
interface FolderGraph {
  folderPath: string;
  nodes: MapNode[];
  edges: MapEdge[];
}
```

`MapEdge.kind` distinguishes folder `containment` from resolved note `link` relationships. A non-root folder graph has one `current-folder` node and one containment edge to every direct child. No synthetic parent node is generated.

## Saved plugin data

Obsidian stores the following through `Plugin.loadData()` and `Plugin.saveData()`:

```ts
interface KnowledgeMapData {
  schemaVersion: number;
  settings: KnowledgeMapSettings;
  mapStates: Record<string, FolderMapState>;
  globePositions: Record<string, Record<string, GlobePosition>>;
}
```

Each `FolderMapState` contains only viewport and node coordinates. Automatic coordinates are recalculated from the deterministic hierarchy layout; a dragged node is marked fixed and its saved coordinates take precedence. Globe coordinates are stored separately as latitude and longitude. A 250 ms debounce combines frequent drag/zoom updates. On plugin unload, pending data is flushed immediately.

## Rename and delete behavior

- Rename or move: matching folder-map keys and node IDs are migrated.
- Delete: matching saved maps and node positions are removed.
- No plugin action deletes a vault file.
- Schema migrations run during plugin load so later versions can evolve safely.
