import { catalog, finiteNumber } from './catalog'

export interface PipelineNode { id: string; type: string; data: Record<string, any> }
export interface Link { source: string; sourcePort: string; target: string; targetPort: string }
export interface NodeResult { outputs: Record<string, any>; error?: string }
interface CachedResult { signature: unknown[]; result: NodeResult }

export function createsCycle(source: string, target: string, links: Link[]): boolean {
    const pending = [target], visited = new Set<string>()
    while (pending.length) {
        const id = pending.pop()!
        if (id === source) return true
        if (visited.has(id)) continue
        visited.add(id)
        for (const link of links) if (link.source === id) pending.push(link.target)
    }
    return false
}

/** Evaluates a snapshot in dependency order. Results never mutate the live model. */
export class Pipeline {
    private cache = new Map<string, CachedResult>()

    async evaluate(nodes: PipelineNode[], links: Link[]): Promise<Map<string, NodeResult>> {
        const results = new Map<string, NodeResult>()
        const nodesById = new Map(nodes.map(n => [n.id, n]))
        const indegrees = new Map(nodes.map(n => [n.id, 0]))
        const incoming = new Map<string, Link[]>(), outgoing = new Map<string, Link[]>()
        for (const link of links) {
            if (!nodesById.has(link.source) || !nodesById.has(link.target)) continue
            indegrees.set(link.target, indegrees.get(link.target)! + 1)
            incoming.set(link.target, [...incoming.get(link.target) ?? [], link])
            outgoing.set(link.source, [...outgoing.get(link.source) ?? [], link])
        }
        const queue = nodes.filter(n => indegrees.get(n.id) === 0)
        for (let i = 0; i < queue.length; i++) {
            const node = queue[i], op = catalog[node.type]
            const values: Record<string, any> = {}
            const settings = { ...node.data }
            const inputs = incoming.get(node.id) ?? []
            const signature: unknown[] = [node.type, settings.image, ...op.fields.map(f => settings[f.id] ?? f.defaultValue)]
            let result: NodeResult
            try {
                for (const field of op.fields) settings[field.id] ??= field.defaultValue
                for (const input of op.inputs) {
                    const link = inputs.find(l => l.targetPort === `in:${input.id}`)
                    // A connected but unavailable value must not fall back to a local setting.
                    const value = link ? results.get(link.source)?.outputs[link.sourcePort.slice(4)] : settings[input.id] ?? input.defaultValue
                    values[input.id] = value == null || input.type !== 'number' ? value : finiteNumber(value)
                    signature.push(values[input.id])
                }
                const cached = this.cache.get(node.id)
                if (cached && signature.length === cached.signature.length && signature.every((v, idx) => Object.is(v, cached.signature[idx]))) {
                    result = cached.result
                } else {
                    const missing = op.inputs.find(input => values[input.id] == null && !(node.type === 'basic.source' && input.id === 'url' && !inputs.length))
                    result = missing ? { outputs: {} } : { outputs: await op.compute(values, settings) }
                    this.cache.set(node.id, { signature, result })
                }
            } catch (e) {
                result = { outputs: {}, error: e instanceof Error ? e.message : 'Processing failed.' }
                this.cache.delete(node.id)
            }
            results.set(node.id, result)
            for (const link of outgoing.get(node.id) ?? []) {
                indegrees.set(link.target, indegrees.get(link.target)! - 1)
                if (indegrees.get(link.target) === 0) queue.push(nodesById.get(link.target)!)
            }
        }
        for (const n of nodes) if (!results.has(n.id)) results.set(n.id, { outputs: {}, error: 'Cycles are not supported.' })
        for (const id of this.cache.keys()) if (!nodesById.has(id)) this.cache.delete(id)
        return results
    }
}
