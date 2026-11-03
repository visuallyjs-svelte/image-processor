import { isPort, type BrowserUIModel, type Port, type Vertex } from '@visuallyjs/browser-ui'
import { createsCycle, type Link } from './pipeline'
import { catalog } from './catalog'

export function extractPorts(data: Record<string, any>) {
    const op = catalog[data.type]
    if (!op) return []
    return [
        ...op.inputs.map(p => ({ id: `in:${p.id}`, type: 'target', datatype: p.type, input: true })),
        ...op.outputs.map(p => ({ id: `out:${p.id}`, type: 'source', datatype: p.type, output: true }))
    ]
}

export function graphLinks(model: BrowserUIModel): Link[] {
    return model.getAllEdges().filter(e => isPort(e.source) && isPort(e.target)).map(e => ({
        source: (e.source as Port).getParent().id, sourcePort: e.source.id,
        target: (e.target as Port).getParent().id, targetPort: e.target.id
    }))
}

export function canConnect(model: BrowserUIModel | undefined, source: Vertex, target: Vertex): boolean {
    return isPort(source) && isPort(target)
        && source.data.output === true && target.data.input === true
        && source.data.datatype === target.data.datatype
        && target.getTargetEdges().length === 0
        && !createsCycle(source.getParent().id, target.getParent().id, model ? graphLinks(model) : [])
}
