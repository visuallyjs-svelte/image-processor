<script>
import { catalog } from './catalog'
let { data, vertex } = $props()
const op = $derived(catalog[vertex.type])
</script>
<div class={`processor-node ${op.id.split('.')[0]}`} data-node-id={vertex.id} data-node-type={op.id}>
<header><span>{data.label}</span><button class="delete-node" title="Delete node" aria-label="Delete node">×</button></header>
<div class="ports">{#each [true, false] as input}<div>{#each (input ? op.inputs : op.outputs) as p (p.id)}<div class={`port-row ${input ? 'input' : 'output'}`}><span class="port" data-vjs-port={`${input ? 'in' : 'out'}:${p.id}`} data-vjs-port-type={input ? 'target' : 'source'} data-vjs-target={input ? 'true' : undefined} data-vjs-source={input ? undefined : 'true'} data-vjs-scope={p.type} title={`${p.label} (${p.type})`}></span><span>{p.label}</span></div>{/each}</div>{/each}</div>
{#if ['basic.source','basic.display'].includes(op.id)}<canvas width="200" height="160" aria-label="Image preview"></canvas><footer>{#if op.id === 'basic.source'}<button class="upload-image" title="Upload image">Upload image</button>{:else}<a class="download-image" aria-disabled="true" title="Download image">Download PNG</a>{/if}<span class="dimensions"></span></footer>{:else}<div class="value-preview"></div>{/if}
<div class="node-error" role="status"></div></div>
