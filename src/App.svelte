<script>
import { onMount } from 'svelte'
import { SurfaceComponent } from '@visuallyjs/browser-ui-svelte'
import { createProcessor } from './processor'
import { nativeView } from './view-options'
import './style.css'
const processor = createProcessor(), view = nativeView(processor.viewOptions)
let root, surfaceComponent
onMount(() => processor.attach(surfaceComponent.getSurface(), root, import.meta.env.BASE_URL))
</script>
<div bind:this={root}><main class="image-processor">
      <aside class="palette-panel">
        <h1>Image Processor</h1>
        <p>Drag a node onto the canvas.</p>
        <div id="palette" aria-label="Node palette"></div>
      </aside>
      <section class="workspace" aria-label="Image processing graph">
        <div id="canvas"><SurfaceComponent bind:this={surfaceComponent} renderOptions={processor.renderOptions} modelOptions={processor.modelOptions} viewOptions={view}/></div>
        <div id="controls" class="vjs-controls"></div>
        <div id="miniview" class="vjs-miniview"></div>
        <div class="canvas-help">Drop images here · Connect matching ports · Select a node to edit</div>
        <div id="status" role="status" aria-live="polite">Loading example…</div>
      </section>
      <aside class="inspector-panel">
        <h2>Properties</h2>
        <div id="inspector"></div>
        <p class="inspector-help">Connected values override local settings. Disconnect an input to use its local value again.</p>
      </aside>
</main></div>
