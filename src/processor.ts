import {
    Palette, MiniviewPlugin, ControlsPlugin,
    EVENT_CANVAS_CLICK, EVENT_NODE_UPDATED, EVENT_NODE_ADDED, EVENT_NODE_REMOVED,
    EVENT_EDGE_ADDED, EVENT_EDGE_REMOVED, EVENT_DATA_LOAD_END,
    CONNECTOR_TYPE_QUADRATIC_BEZIER, type BrowserUIModel, type Node, type Surface, type Vertex
} from '@visuallyjs/browser-ui'
import { catalog, groups, nodeData } from './catalog'
import { Pipeline, type NodeResult } from './pipeline'
import { graphLinks, canConnect, extractPorts } from './connections'
import { createView, modelEvents } from './view'
import { createInspector } from './inspector'
import { readImageFromFile, imageURLToImage, setCanvasImageFromImage, imageToBlob, imageWidth, imageHeight, isProcessingImage, type ProcessingImage } from './processing'


export function createProcessor() {
    let model: BrowserUIModel
    let uploadImage: (id: string) => void = () => {}
    const viewOptions = createView(() => model)
    const renderOptions = {
        zoomToFit: true,
        activeFiltering: true,
        magnetizer: { afterDrag: true },
        consumeRightClick: false,
        dragOptions: { cssFilter: 'button,a,input,select' },
        edges: { connector: CONNECTOR_TYPE_QUADRATIC_BEZIER },
        events: { [EVENT_CANVAS_CLICK]: () => model.clearSelection() },
        modelEvents: modelEvents(id => uploadImage(id))
    }
    const modelOptions = {
        portExtractor: extractPorts,
        beforeConnect: (source: Vertex, target: Vertex) => canConnect(model, source, target)
    }
    function attach(surface: Surface, root: HTMLElement, baseURL = './') {
        model = surface.model
        const canvas = root.querySelector<HTMLElement>('#canvas')!
        const palette = root.querySelector<HTMLElement>('#palette')!
        const status = root.querySelector<HTMLElement>('#status')!
        const abort = new AbortController()
        let disposed = false
        const bindings: Array<[string, any]> = []
        function bind(event: string, handler: any) { model.bind(event, handler); bindings.push([event, handler]) }
        const inspector = createInspector(surface, root.querySelector<HTMLElement>('#inspector')!)
        const miniview = surface.addPlugin({ type: MiniviewPlugin.type, options: { container: root.querySelector('#miniview')!, typeFunction: (n: Node) => n.type.split('.')[0] } })
        const controls = surface.addPlugin({ type: ControlsPlugin.type, options: { container: root.querySelector('#controls')! } })
        uploadImage = upload
        for (const group of groups) {
            const section = document.createElement('section')
            section.className = `palette-section ${group}`
            const heading = document.createElement('h2')
            heading.textContent = group
            section.append(heading)
            for (const op of Object.values(catalog).filter(op => op.id.startsWith(`${group}.`))) {
                const item = document.createElement('div')
                item.dataset.vjsType = op.id
                item.className = 'palette-item'
                item.textContent = op.name
                section.append(item)
            }
            palette.append(section)
        }
        const paletteWidget = new Palette(surface, {
            source: palette,
            selectAfterAdd: true,
            dataGenerator: el => nodeData(el.getAttribute('data-vjs-type')!)
        })

        const processor = new Pipeline()
        const downloads = new Map<string, { image: ProcessingImage; url: string }>()
        let revision = 0, running = false
        function schedule() {
            revision++
            if (!running && !disposed) void process()
        }
        async function process() {
            running = true
            try {
                let current: number
                do {
                    current = revision
                    const nodes = model.getNodes().map(n => ({ id: n.id, type: n.type, data: { ...n.data } }))
                    const results = await processor.evaluate(nodes, graphLinks(model))
                    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
                    if (disposed) return
                    if (current !== revision) continue
                    let errors = 0
                    for (const node of model.getNodes()) {
                        const result = results.get(node.id)!
                        if (result) await paint(node, result)
                        if (result?.error) errors++
                    }
                    for (const [id, entry] of downloads) if (!model.getNode(id)) {
                        URL.revokeObjectURL(entry.url)
                        downloads.delete(id)
                    }
                    status.textContent = errors ? `${errors} node${errors === 1 ? '' : 's'} need attention. Select a node to check its settings.` : ''
                } while (current !== revision)
            } catch (e) {
                showError(e)
            } finally {
                running = false
            }
        }

        async function paint(node: Node, result: NodeResult) {
            const el = surface.getRenderedElement(node) as HTMLElement
            if (!el) return
            const error = el.querySelector<HTMLElement>('.node-error')
            if (!error) return
            error.textContent = result.error ?? ''
            el.classList.toggle('has-error', !!result.error)
            const preview = el.querySelector<HTMLCanvasElement>('canvas')
            if (preview) {
                const image = result.outputs.image as ProcessingImage | undefined
                const ctx = preview.getContext('2d')!
                ctx.clearRect(0, 0, preview.width, preview.height)
                if (image) setCanvasImageFromImage(preview, preview.width, preview.height, image)
                else {
                    ctx.fillStyle = '#6a7580'
                    ctx.font = '13px sans-serif'
                    ctx.textAlign = 'center'
                    ctx.fillText(node.type === 'basic.source' ? 'Upload or drop an image' : 'Connect an image input', 100, 80)
                }
                el.querySelector('.dimensions')!.textContent = image ? `${imageWidth(image)}×${imageHeight(image)}` : ''
                const download = el.querySelector<HTMLAnchorElement>('.download-image')
                if (download) {
                    download.setAttribute('aria-disabled', String(!image))
                    const cached = downloads.get(node.id)
                    if (cached && cached.image !== image) {
                        URL.revokeObjectURL(cached.url)
                        downloads.delete(node.id)
                    }
                    if (image) {
                        let entry = downloads.get(node.id)
                        if (!entry) {
                            entry = { image, url: URL.createObjectURL(await imageToBlob(image)) }
                            downloads.set(node.id, entry)
                        }
                        download.href = entry.url
                        download.download = `${node.data.label || 'image'}.png`
                    } else download.removeAttribute('href')
                }
            } else {
                const summary = el.querySelector<HTMLElement>('.value-preview')
                if (!summary) return
                summary.textContent = Object.entries(result.outputs).filter(([, v]) => v != null && !isProcessingImage(v))
                    .map(([k, v]) => `${k}: ${v}`).join(' · ')
            }
        }

        for (const event of [EVENT_NODE_ADDED, EVENT_NODE_REMOVED, EVENT_EDGE_ADDED, EVENT_EDGE_REMOVED, EVENT_DATA_LOAD_END]) bind(event, schedule)
        bind(EVENT_NODE_UPDATED, (p: { updates: Record<string, unknown> }) => {
            if (Object.keys(p.updates).some(k => !['left', 'top', 'nodeWidth', 'nodeHeight'].includes(k))) schedule()
        })

        function showError(e: unknown) {
            if (disposed) return
            status.textContent = e instanceof Error ? e.message : 'Could not process the image.'
        }
        async function setImage(id: string, image: HTMLImageElement) {
            const node = model.getNode(id)
            if (!disposed && node) model.updateNode(node, { image, url: undefined })
        }
        function upload(id: string) {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.addEventListener('change', () => {
                const file = input.files?.[0]
                if (file) readImageFromFile(file).then(image => setImage(id, image)).catch(showError)
            })
            input.click()
        }

        // Native image drops coexist with VisuallyJs's palette and edge dragging.
        canvas.addEventListener('dragover', e => {
            e.preventDefault()
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
            canvas.classList.add('image-drop-active')
        }, { signal: abort.signal })
        canvas.addEventListener('dragleave', e => {
            if (!canvas.contains(e.relatedTarget as globalThis.Node | null)) canvas.classList.remove('image-drop-active')
        }, { signal: abort.signal })
        canvas.addEventListener('drop', async e => {
            e.preventDefault()
            canvas.classList.remove('image-drop-active')
            const dt = e.dataTransfer
            if (!dt) return
            const target = (e.target as HTMLElement).closest<HTMLElement>('[data-node-type="basic.source"]')
            const position = surface.mapEventLocation(e)
            const urls = dt.getData('text/uri-list').split(/\r?\n/).filter(s => s && !s.startsWith('#'))
            const url = urls[0] || dt.getData('text/plain')
            const files = [...dt.files].filter(f => f.type.startsWith('image/'))
            if (!files.length && !url) { showError(new Error('Drop an image file or image URL.')); return }
            try {
                const images = files.length ? await Promise.all(files.map(readImageFromFile)) : [await imageURLToImage(url)]
                if (disposed) return
                images.forEach((image, idx) => {
                    if (target && idx === 0) void setImage(target.dataset.nodeId!, image)
                    else {
                        const n = model.addNode({ ...nodeData('basic.source'), image, left: position.x + idx * 40, top: position.y + idx * 40 })
                        model.setSelection(n)
                    }
                })
            } catch (error) { showError(error) }
        }, { signal: abort.signal })

        async function start() {
            const response = await fetch(`${baseURL}dataset.json`, { signal: abort.signal })
            if (!response.ok) throw new Error('Could not load the example pipeline.')
            const data = await response.json()
            data.nodes = await Promise.all(data.nodes.map(async (n: Record<string, any>) => {
                const prepared = { ...nodeData(n.type), ...n }
                if (n.url) prepared.image = await imageURLToImage(`${baseURL}${n.url.replace(/^\//, '')}`)
                delete prepared.url
                return prepared
            }))
            if (!disposed) model.load({ data })
        }
        start().catch(showError)

        return () => {
            disposed = true
            abort.abort()
            for (const [event, handler] of bindings) model.unbind(event, handler)
            for (const entry of downloads.values()) URL.revokeObjectURL(entry.url)
            downloads.clear()
            paletteWidget.setEnabled(false)
            inspector.reset(true)
            miniview.destroy()
            controls.destroy()
            palette.replaceChildren()
        }
    }
    return { renderOptions, modelOptions, viewOptions, attach }
}
