import {
    DEFAULT, EVENT_TAP, EVENT_CLICK, EVENT_DBLCLICK, AnchorLocations, LabelOverlay,
    ArrowOverlay, type BrowserUIModel, type NodeEventCallbackPayload,
    type EdgeEventCallbackPayload, type ModelEventCallbackPayload, type BrowserElement
} from '@visuallyjs/browser-ui'
import { catalog, type Socket } from './catalog'

function portTemplate(p: Socket, input: boolean): string {
    return `<div class="port-row ${input ? 'input' : 'output'}">
        <span class="port" data-vjs-port="${input ? 'in' : 'out'}:${p.id}"
            data-vjs-port-type="${input ? 'target' : 'source'}" data-vjs-${input ? 'target' : 'source'}="true"
            data-vjs-scope="${p.type}" title="${p.label} (${p.type})"></span>
        <span>${p.label}</span></div>`
}

export function createView(model: () => BrowserUIModel) {
    return {
        nodes: Object.fromEntries(Object.values(catalog).map(op => {
            const group = op.id.split('.')[0]
            const preview = op.id === 'basic.source' || op.id === 'basic.display'
            return [op.id, {
                template: `<div class="processor-node ${group}" data-node-id="{{id}}" data-node-type="${op.id}">
                    <header><span>{{label}}</span><button class="delete-node" title="Delete node" aria-label="Delete node">×</button></header>
                    <div class="ports"><div>${op.inputs.map(p => portTemplate(p, true)).join('')}</div><div>${op.outputs.map(p => portTemplate(p, false)).join('')}</div></div>
                    ${preview ? `<canvas width="200" height="160" aria-label="Image preview"></canvas><footer>
                        ${op.id === 'basic.source' ? '<button class="upload-image" title="Upload image">Upload image</button>' : '<a class="download-image" aria-disabled="true" title="Download image">Download PNG</a>'}
                        <span class="dimensions"></span></footer>` : '<div class="value-preview"></div>'}
                    <div class="node-error" role="status"></div>
                </div>`,
                events: { [EVENT_TAP]: (p: NodeEventCallbackPayload<BrowserElement>) => {
                    if ((p.e?.target as Element | null)?.closest('button,a,input,select')) return
                    model().setSelection(p.obj)
                } }
            }]
        })),
        ports: {
            source: { isSource: true, maxConnections: -1, anchor: AnchorLocations.Right },
            target: { isTarget: true, maxConnections: 1, anchor: AnchorLocations.Left }
        },
        edges: {
            [DEFAULT]: {
                detachable: false,
                targetMarker: ArrowOverlay.type,
                overlays: [{
                    type: LabelOverlay.type,
                    options: {
                        label: '×', cssClass: 'delete-edge',
                        events: { [EVENT_CLICK]: (p: EdgeEventCallbackPayload & { edge?: EdgeEventCallbackPayload['obj'] }) => {
                            p.e?.preventDefault()
                            p.e?.stopPropagation()
                            model().removeEdge(p.edge ?? p.obj)
                        } }
                    }
                }],
                events: { [EVENT_DBLCLICK]: (p: EdgeEventCallbackPayload) => model().removeEdge(p.obj) }
            }
        }
    }
}

export function modelEvents(upload: (id: string) => void) {
    return [
        { event: EVENT_TAP, selector: '.delete-node', callback: (p: ModelEventCallbackPayload) => {
            p.model.removeNode(p.objectInfo.obj)
        } },
        { event: EVENT_TAP, selector: '.upload-image', callback: (p: ModelEventCallbackPayload) => {
            upload(p.objectInfo.obj.id)
        } }
    ]
}
