# Integrations

## Excalidraw

Knowledge Map does not copy or bundle the Obsidian Excalidraw plugin. Excalidraw is a large, independently maintained AGPL-3.0 plugin with its own view registrations, commands, settings, optional network features, and scripting system. Bundling it inside Knowledge Map would create duplicate registrations and turn this repository into an Excalidraw fork.

Instead, `src/integrations/excalidraw.ts` uses the installed plugin's public `window.ExcalidrawAutomate` API. It can:

- create an empty native Excalidraw drawing;
- generate a native Excalidraw drawing from the current folder graph;
- assign vault links to generated note nodes;
- leave all subsequent text, icon, shape, drawing, and drag-and-drop behavior to Excalidraw itself.

This integration requires the user to install and enable **Excalidraw** separately. If it is unavailable, Knowledge Map displays a notice instead of failing.

References:

- <https://github.com/zsviczian/obsidian-excalidraw-plugin>
- <https://zsviczian.github.io/obsidian-excalidraw-plugin/>

## Globe renderer

The globe renderer is native to Knowledge Map and lazy-loads Three.js only when the globe view opens. Its coordinate conversion and interaction rules were adapted from the user's local `Knowledge-main` project. The bundled day and cloud textures were copied from that same project and should retain their original provenance records before public distribution.

