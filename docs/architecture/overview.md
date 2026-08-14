# Architecture

Knowledge Map is one Obsidian plugin with replaceable renderers over shared data.

```text
Obsidian Vault + MetadataCache
            │
            ▼
      VaultGraphBuilder
            │
            ▼
   FolderGraph (read-only)
            │
     ┌──────┴──────┐
     ▼             ▼
GraphRenderer   KnowledgeMapStore
SVG + input     positions/settings
```

## Source folders

| Folder | Responsibility |
| --- | --- |
| `src/core` | UI-independent graph types and path rules. |
| `src/data` | Plugin data schema, migration, and saving. |
| `src/obsidian` | Translation from Obsidian files and metadata into graph data. |
| `src/services` | Navigation and layout algorithms. |
| `src/views` | Obsidian `ItemView` and the SVG graph renderer. |
| `src/settings` | User-facing plugin settings. |
| `tests` | Fast tests for rules that do not require the Obsidian app. |

`src/main.ts` intentionally contains only plugin lifecycle, registration, and event wiring.
