# Image Processor — Svelte

A self-contained Svelte version of `vanilla/image-processor`, using the VisuallyJS Svelte surface and native node components. The processing engine, catalog, connection validation, inspector, sample images and pixel baselines are copied locally. The processing license is in `src/processing/LICENSE`.

Use Node.js 22.13.1 or later.

```sh
npm install
npm run dev
npm run check
npm run build
```

Drag operations from the palette, connect matching ports, and select nodes to edit settings. Upload or drop images (files or image URLs) onto sources or canvas whitespace. Display nodes download full-resolution PNGs.

The browser regression suite is at `/tests/` when the Vite development server is running.

The saved pixel baseline is browser-dependent. In the available Chromium build, both vanilla and these ports report the same 49 pixel comparisons as failures; all 57 functional checks pass.
