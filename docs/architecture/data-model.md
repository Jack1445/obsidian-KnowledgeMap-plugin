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

## Saved plugin data

Obsidian stores the following through `Plugin.loadData()` and `Plugin.saveData()`:

```ts
interface KnowledgeMapData {
  schemaVersion: number;
  settings: KnowledgeMapSettings;
  mapStates: Record<string, FolderMapState>;
}
```

Each `FolderMapState` contains only viewport and node coordinates. A 250 ms debounce combines frequent drag/zoom updates. On plugin unload, pending data is flushed immediately.

## Rename and delete behavior

- Rename or move: matching folder-map keys and node IDs are migrated.
- Delete: matching saved maps and node positions are removed.
- No plugin action deletes a vault file.
- Schema migrations run during plugin load so later versions can evolve safely.
