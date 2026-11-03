import { newInstance } from '@visuallyjs/browser-ui'
import { catalog, nodeData } from '../src/catalog'
import { Pipeline, createsCycle, type PipelineNode, type Link } from '../src/pipeline'
import { canConnect, graphLinks, extractPorts } from '../src/connections'
import { imageWidth, imageHeight, type ProcessingImage, imageURLToImage, imageToDataURL, readImageFromFile } from '../src/processing'
import { collectPixels, pixelCases } from './pixel-cases'

let passed = 0, failed = 0
function assert(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message)
}
async function test(name: string, fn: () => Promise<void> | void) {
    const li = document.createElement('li')
    try { await fn(); passed++; li.textContent = `PASS: ${name}` }
    catch (e) { failed++; li.textContent = `FAIL: ${name} — ${e}` }
    document.querySelector('#checks')!.append(li)
}
const node = (id: string, type: string, data = {}): PipelineNode => ({ id, type, data: { ...nodeData(type), ...data } })
const link = (source: string, target: string, targetPort = 'image', sourcePort = 'image'): Link => ({ source, target, sourcePort: `out:${sourcePort}`, targetPort: `in:${targetPort}` })
const pixels = (image: ProcessingImage) => {
    const c = document.createElement('canvas'); c.width = imageWidth(image); c.height = imageHeight(image)
    const ctx = c.getContext('2d')!; ctx.drawImage(image, 0, 0)
    return ctx.getImageData(0, 0, c.width, c.height).data
}
const c = document.createElement('canvas'); c.width = 4; c.height = 2
const ctx = c.getContext('2d')!
ctx.fillStyle = '#c86432'; ctx.fillRect(0, 0, 2, 2)
ctx.fillStyle = '#1464dc'; ctx.fillRect(2, 0, 2, 2)
const image = await imageURLToImage(c.toDataURL())

for (const op of Object.values(catalog)) {
    await test(`${op.id}: evaluates declared outputs`, async () => {
        const pipeline = new Pipeline(), nodes = [node('source', 'basic.source', { image }), node('operation', op.id, { image })]
        const links: Link[] = []
        for (const input of op.inputs) {
            if (input.type === 'image') links.push(link('source', 'operation', input.id))
            else if (op.id === 'basic.source') {
                nodes.push(node('url', 'input.text', { value: image.src }))
                links.push(link('url', 'operation', input.id, 'value'))
            } else if (input.defaultValue === undefined) {
                const id = `number-${input.id}`
                nodes.push(node(id, 'input.number', { value: 2 }))
                links.push(link(id, 'operation', input.id, 'value'))
            }
        }
        const r = (await pipeline.evaluate(nodes, links)).get('operation')!
        assert(!r.error, r.error ?? '')
        for (const output of op.outputs) assert(r.outputs[output.id] != null, `Missing output ${output.id}`)
        if (op.id === 'transform.resize' || op.id === 'transform.crop') {
            assert(imageWidth(r.outputs.image) === 150 && imageHeight(r.outputs.image) === 150, 'Requested dimensions were not applied')
        }
    })
}
await test('Injected zero overrides a local value; disconnect restores local value', async () => {
    const pipeline = new Pipeline(), nodes = [node('src', 'basic.source', { image }), node('n', 'input.number', { value: 0 }), node('invert', 'filter.invert', { amount: 100 })]
    const base = [link('src', 'invert')]
    const first = (await pipeline.evaluate(nodes, [...base, link('n', 'invert', 'amount', 'value')])).get('invert')!
    assert(imageToDataURL(first.outputs.image) === imageToDataURL(image), 'Injected zero was ignored')
    const second = (await pipeline.evaluate(nodes, base)).get('invert')!
    assert(pixels(second.outputs.image)[0] === 55, 'Local inversion was not restored')
})
await test('Fan-out, reconvergence, numeric coercion and source removal', async () => {
    const pipeline = new Pipeline()
    const nodes = [node('a', 'input.number', { value: '3' }), node('b', 'input.number', { value: '2' }), node('sum', 'math.add'), node('product', 'math.multiply'), node('result', 'math.subtract')]
    const links = [link('a', 'sum', 'a', 'value'), link('b', 'sum', 'b', 'value'), link('a', 'product', 'a', 'value'), link('b', 'product', 'b', 'value'), link('product', 'result', 'a', 'result'), link('sum', 'result', 'b', 'result')]
    let r = await pipeline.evaluate([...nodes].reverse(), links)
    assert(r.get('result')!.outputs.result === 1, 'Reconvergent result is wrong')
    nodes[0].data.value = '4'
    r = await pipeline.evaluate(nodes, links)
    assert(r.get('result')!.outputs.result === 2, 'Changed input did not propagate')
    r = await pipeline.evaluate(nodes.slice(1), links.filter(e => e.source !== 'a'))
    assert(r.get('result')!.outputs.result == null, 'Removed source left a stale output')
})
await test('Failures clear descendants without breaking independent branches', async () => {
    const r = await new Pipeline().evaluate([node('a', 'input.number', { value: 1 }), node('b', 'input.number', { value: 0 }), node('divide', 'math.divide'), node('next', 'math.add'), node('independent', 'input.boolean')], [link('a', 'divide', 'a', 'value'), link('b', 'divide', 'b', 'value'), link('divide', 'next', 'a', 'result'), link('a', 'next', 'b', 'value')])
    assert(r.get('divide')!.error, 'Division by zero should report an error')
    assert(r.get('next')!.outputs.result == null, 'Failure left stale descendant data')
    assert(r.get('independent')!.outputs.value === false, 'False was lost')
})
await test('Crop uses offsets; mirror preserves dimensions; opacity zero is transparent', async () => {
    const pipeline = new Pipeline(), nodes = [node('s', 'basic.source', { image }), node('crop', 'transform.crop', { x: 2, y: 0, width: 2, height: 2 }), node('mirror', 'transform.mirror'), node('opacity', 'filter.opacity', { amount: 0 })]
    const r = await pipeline.evaluate(nodes, [link('s', 'crop'), link('s', 'mirror'), link('s', 'opacity')])
    assert(pixels(r.get('crop')!.outputs.image)[0] === 20, 'Crop offset ignored')
    assert(pixels(r.get('mirror')!.outputs.image)[0] === 20, 'Mirror axis ignored')
    assert(pixels(r.get('opacity')!.outputs.image)[3] === 0, 'Opacity zero ignored')
})
await test('Connection validation: types, direction, capacity, self edges and cycles', () => {
    const model = newInstance({ portExtractor: extractPorts })
    const a = model.addNode({ ...nodeData('basic.display'), id: 'a' })
    const b = model.addNode({ ...nodeData('basic.display'), id: 'b' })
    const n = model.addNode({ ...nodeData('input.number'), id: 'n' })
    assert(canConnect(model, a.getPort('out:image'), b.getPort('in:image')), 'Valid edge rejected')
    assert(!canConnect(model, n.getPort('out:value'), b.getPort('in:image')), 'Wrong datatype accepted')
    assert(!canConnect(model, a.getPort('in:image'), b.getPort('out:image')), 'Reversed edge accepted')
    assert(!canConnect(model, a.getPort('out:image'), a.getPort('in:image')), 'Self edge accepted')
    model.addEdge({ source: a.getPort('out:image'), target: b.getPort('in:image') })
    assert(graphLinks(model).length === 1, 'Port edges were omitted')
    assert(!canConnect(model, a.getPort('out:image'), b.getPort('in:image')), 'Second input connection accepted')
    assert(!canConnect(model, b.getPort('out:image'), a.getPort('in:image')), 'Cycle accepted')
    assert(createsCycle('b', 'a', graphLinks(model)), 'Cycle not detected')
})
await test('Programmatic cycles terminate and report errors', async () => {
    const r = await new Pipeline().evaluate([node('a', 'basic.display'), node('b', 'basic.display')], [link('a', 'b'), link('b', 'a')])
    assert(r.get('a')!.error && r.get('b')!.error, 'Cycle did not report errors')
})
await test('Original cow-and-glasses pipeline renders downloadable full-resolution outputs', async () => {
    const data = await (await fetch('/dataset.json')).json()
    const nodes: PipelineNode[] = await Promise.all(data.nodes.map(async (n: any) => node(n.id, n.type, { ...n, url: undefined, ...(n.url ? { image: await imageURLToImage(n.url) } : {}) })))
    const links: Link[] = data.edges.map((e: any) => ({ source: e.source.split('.')[0], sourcePort: e.source.split('.')[1], target: e.target.split('.')[0], targetPort: e.target.split('.')[1] }))
    const r = await new Pipeline().evaluate(nodes, links)
    for (const id of ['4', '7']) {
        assert(imageWidth(r.get(id)!.outputs.image) === 1440, 'Full image resolution was lost')
        assert(imageToDataURL(r.get(id)!.outputs.image).startsWith('data:image/png'), 'PNG export failed')
    }
    assert(imageToDataURL(r.get('4')!.outputs.image) !== imageToDataURL(r.get('7')!.outputs.image), 'Invert did not change image')
})
await test('File decoding succeeds for images and rejects invalid files', async () => {
    const blob = await (await fetch(image.src)).blob()
    const loaded = await readImageFromFile(new File([blob], 'sample.png', { type: 'image/png' }))
    assert(loaded.naturalWidth === 4, 'File image failed to decode')
    let rejected = false
    try { await readImageFromFile(new File(['invalid'], 'broken.png', { type: 'image/png' })) } catch { rejected = true }
    assert(rejected, 'Invalid image did not reject')
})

const reference = await (await fetch('./pixel-baseline.json')).json() as Awaited<ReturnType<typeof collectPixels>>
const actual = await collectPixels()
for (const [name, expected] of Object.entries(reference)) {
    await test(`Pre-optimization pixel parity: ${name}`, () => {
        const result = actual[name]
        assert(result.width === expected.width && result.height === expected.height, 'Image dimensions changed')
        const differences = result.pixels.filter((value, index) => value !== expected.pixels[index]).length
        assert(differences === 0, `${differences} pixel channels differ`)
    })
}
await test('Filters and transforms never encode intermediate images', async () => {
    const cases = await pixelCases()
    const toDataURL = HTMLCanvasElement.prototype.toDataURL
    const toBlob = HTMLCanvasElement.prototype.toBlob
    let encodings = 0
    HTMLCanvasElement.prototype.toDataURL = function(...args) { encodings++; return toDataURL.apply(this, args) }
    HTMLCanvasElement.prototype.toBlob = function(...args) { encodings++; return toBlob.apply(this, args) }
    try {
        for (const fn of Object.values(cases)) assert(await fn() instanceof HTMLCanvasElement, 'Intermediate output was not a canvas')
        assert(encodings === 0, `${encodings} intermediate PNG encodings`)
    } finally {
        HTMLCanvasElement.prototype.toDataURL = toDataURL
        HTMLCanvasElement.prototype.toBlob = toBlob
    }
})
await test('Properties and Display accept transformed canvases', async () => {
    const r = await new Pipeline().evaluate([
        node('s', 'basic.source', { image }), node('resize', 'transform.resize', { width: 7, height: 9 }),
        node('properties', 'basic.properties'), node('display', 'basic.display')
    ], [link('s', 'resize'), link('resize', 'properties'), link('resize', 'display')])
    assert(r.get('properties')!.outputs.width === 7 && r.get('properties')!.outputs.height === 9, 'Canvas dimensions were lost')
    assert(r.get('display')!.outputs.image === r.get('resize')!.outputs.image, 'Display did not pass through canvas')
})

// Exercise the actual app's event handlers in an isolated same-origin frame.
const frame = document.createElement('iframe')
frame.style.cssText = 'position:absolute;left:-2000px;width:1280px;height:720px'
frame.src = '/'
document.body.append(frame)
const until = async (condition: () => boolean) => {
    const deadline = Date.now() + 10000
    while (!condition()) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for app update')
        await new Promise(r => setTimeout(r, 40))
    }
}
await test('App starts with both downloadable outputs', async () => {
    await until(() => frame.contentDocument?.querySelectorAll('.download-image[href^="blob:"]').length === 2)
})
const app = () => frame.contentDocument!
const drop = (target: Element, dt: DataTransfer) => target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
const sampleFile = new File([await (await fetch(image.src)).blob()], 'test.png', { type: 'image/png' })
await test('Native file drop on whitespace adds a source node', async () => {
    const dt = new DataTransfer(); dt.items.add(sampleFile)
    const count = app().querySelectorAll('.processor-node').length
    drop(app().querySelector('#canvas')!, dt)
    await until(() => app().querySelectorAll('.processor-node').length === count + 1)
    await until(() => [...app().querySelectorAll('.dimensions')].some(e => e.textContent === '4×2'))
})
await test('Native file drop on source replaces image and recalculates descendants', async () => {
    const dt = new DataTransfer(); dt.items.add(sampleFile)
    drop(app().querySelector('[data-node-id="1"] canvas')!, dt)
    await until(() => app().querySelector('[data-node-id="4"] .dimensions')?.textContent === '4×2')
    await until(() => app().querySelector('[data-node-id="7"] .dimensions')?.textContent === '4×2')
})
await test('Native image URL drop adds a source', async () => {
    const dt = new DataTransfer(); dt.setData('text/plain', image.src)
    const count = app().querySelectorAll('.processor-node').length
    drop(app().querySelector('#canvas')!, dt)
    await until(() => app().querySelectorAll('.processor-node').length === count + 1)
})
await test('Non-image drops are reported without altering the graph', async () => {
    const dt = new DataTransfer(); dt.items.add(new File(['text'], 'test.txt', { type: 'text/plain' }))
    const count = app().querySelectorAll('.processor-node').length
    drop(app().querySelector('#canvas')!, dt)
    await until(() => app().querySelector('#status')!.textContent!.includes('Drop an image'))
    assert(app().querySelectorAll('.processor-node').length === count, 'Non-image file created a node')
})
await test('Display download is a valid full-resolution PNG Blob', async () => {
    const anchor = app().querySelector<HTMLAnchorElement>('[data-node-id="4"] .download-image')!
    const response = await fetch(anchor.href)
    const blob = await response.blob()
    assert(blob.type === 'image/png' && blob.size > 0, 'Download is not a PNG Blob')
    const decoded = await imageURLToImage(anchor.href)
    assert(decoded.naturalWidth === 4 && decoded.naturalHeight === 2, 'Download resolution differs from source')
    assert(anchor.download === 'Output.png', 'Download filename was lost')
})
frame.remove()
document.querySelector('#result')!.textContent = `${passed} passed, ${failed} failed`
document.title = `${failed ? 'FAIL' : 'PASS'} — Image Processor tests`
