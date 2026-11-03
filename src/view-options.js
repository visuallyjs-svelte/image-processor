import ProcessorNode from './ProcessorNode.svelte'
export function nativeView(view) {
    return { ...view, nodes: Object.fromEntries(Object.entries(view.nodes).map(([type, definition]) => {
        const { template, ...behavior } = definition
        return [type, { ...behavior, component: ProcessorNode }]
    })) }
}
