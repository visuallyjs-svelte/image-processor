import { VanillaInspector, isNode, type Surface } from '@visuallyjs/browser-ui'
import { catalog, type Field } from './catalog'

function fieldTemplate(field: Field): string {
    const control = field.options
        ? `<select vjs-att="${field.id}">${field.options.map(v => `<option value="${v}">${v === 'x_y' ? 'X and Y' : v}</option>`).join('')}</select>`
        : `<input vjs-att="${field.id}" type="${field.type === 'boolean' ? 'checkbox' : field.type === 'string' ? 'text' : field.type}" ${field.type === 'number' ? 'step="any"' : ''}/>`
    return `<label>${field.label}${control}</label>`
}

export function createInspector(surface: Surface, container: HTMLElement) {
    const inspector = new VanillaInspector({
        ui: surface,
        container,
        multipleSelections: false,
        emptyTemplate: '<p class="empty-inspector">Select a node to edit its settings.</p>',
        templateResolver: obj => {
            if (!isNode(obj)) return ''
            const op = catalog[obj.type]
            return `<div class="node-properties"><h3>${op.name}</h3>
                <label>Label<input type="text" vjs-att="label"/></label>
                ${op.fields.map(fieldTemplate).join('')}
                ${obj.type === 'basic.source' ? '<p>Upload an image on the node, drop an image onto it, or connect a Text node containing an image URL.</p>' : ''}
                </div>`
        }
    })
    // The current library renderer displays numeric zero as a blank string.
    inspector.onChange((values: Record<string, unknown>) => {
        container.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach(input => {
            if (values[input.getAttribute('vjs-att')!] === 0) input.value = '0'
        })
    })
    inspector.reset(false)
    return inspector
}
