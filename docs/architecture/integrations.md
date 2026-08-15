# Integrations

## Excalidraw

Knowledge Map does not copy or bundle the Obsidian Excalidraw plugin. Excalidraw is a large, independently maintained AGPL-3.0 plugin with its own view registrations, commands, settings, optional network features, and scripting system. Bundling it inside Knowledge Map would create duplicate registrations and turn this repository into an Excalidraw fork.

Instead, `src/integrations/excalidraw.ts` uses the installed plugin's public `window.ExcalidrawAutomate` API. It can:

- create an empty native Excalidraw drawing;
- create a live knowledge canvas pre-populated from the current folder graph;
- register per-view pointer and drop behavior without changing the Excalidraw plugin;
- replace only generated map elements during folder drill-down while preserving user-created elements;
- add folders as drillable elements and Markdown notes as directly clickable knowledge elements;
- convert vault file/folder drops into editable knowledge nodes;
- append a reset-layout option to the three-dot tool menu of registered knowledge-canvas views;
- leave text, icons, shapes, free drawing, export, themes, and other canvas behavior to Excalidraw itself.

Generated elements carry `customData.knowledgeMap` metadata. `scope: "map"` identifies the replaceable current-folder layer, while `scope: "manual"` identifies nodes the user explicitly dropped onto the canvas. Knowledge-canvas registration and folder history live in Knowledge Map's own plugin data; existing Excalidraw files that were not created as knowledge canvases remain untouched.

Knowledge Map listens for short, unmoved pointer clicks in registered knowledge-canvas views, so clicking a managed circle or label activates it directly from its custom data. A pointer gesture that moves more than the click threshold remains an ordinary Excalidraw drag. Managed elements do not carry Excalidraw links, avoiding redundant link-indicator icons; older managed elements have those links removed when their knowledge canvas binds.

The reset-layout control is inserted as a real `.dropdown-menu-item` inside Excalidraw's rendered three-dot tool menu. A scoped observer reinserts the option whenever Excalidraw rebuilds or reopens its React-owned menu DOM, and the option is removed when the view unloads. This changes neither Excalidraw's source nor ordinary Excalidraw views.

This integration requires the user to install and enable **Excalidraw** separately. If it is unavailable, Knowledge Map displays a notice instead of failing.

References:

- <https://github.com/zsviczian/obsidian-excalidraw-plugin>
- <https://zsviczian.github.io/obsidian-excalidraw-plugin/>
- <https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/API/ExcalidrawAutomate.d.ts>

## Globe renderer

The globe renderer is native to Knowledge Map and lazy-loads Three.js only when the globe view opens. Its coordinate conversion and interaction rules were adapted from the user's local `Knowledge-main` project. The bundled day and cloud textures were copied from that same project and should retain their original provenance records before public distribution.
