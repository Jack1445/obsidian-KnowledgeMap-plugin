# Testing

## Automated checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Run all of them with `npm run check`.

## Manual Obsidian checklist

Use a disposable test vault containing nested folders, linked notes, an unlinked note, and a cross-folder link.

- Open the map from the ribbon and command palette.
- Drill into a folder and confirm there is no synthetic `..` node, then use back, forward, and breadcrumbs.
- Confirm the current folder is above a naturally sorted row of direct children.
- Confirm a containment edge joins the current folder to every direct child.
- Open a note normally and with Ctrl/Cmd-click.
- Drag several nodes, close and reopen Obsidian, and confirm their positions remain.
- Pan and zoom a map, reopen it, and confirm its viewport remains.
- Create, rename, move, and delete a file and folder while the map is open.
- Add and remove an internal link and confirm the edge updates.
- Toggle external links and labels in settings.
- Test both light and dark themes.
- Reset a folder layout and confirm only that folder is affected.
- Confirm the root map has no visible Vault node.
- Adjust node size and link thickness from the map toolbar.
- With Excalidraw enabled, create a blank canvas and drag vault items into it.
- Export a folder map to Excalidraw and confirm the generated drawing remains fully editable.
- Open the globe, rotate and zoom it, click nodes, drag a node to a new geographic position, and reopen it.
- Open the map, globe, and canvas manager from both their ribbon icons and command-palette entries.
