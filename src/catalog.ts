import * as image from './processing'

export type DataType = 'image' | 'number' | 'string' | 'boolean' | 'color'
export interface Socket {
    id: string
    label: string
    type: DataType
    defaultValue?: string | number | boolean
}
export interface Field extends Socket {
    options?: string[]
}
export interface Operation {
    id: string
    name: string
    inputs: Socket[]
    outputs: Socket[]
    fields: Field[]
    compute: (values: Record<string, any>, settings: Record<string, any>) => Promise<Record<string, any>>
}
const socket = (id: string, label: string, type: DataType, defaultValue?: Socket['defaultValue']): Socket => ({ id, label, type, defaultValue })
const inputImage = socket('image', 'Image', 'image')
const outputImage = [inputImage]
const number = (id: string, label: string, value?: number) => socket(id, label, 'number', value)
export const compositeOperations = ['color', 'color-burn', 'color-dodge', 'darken', 'destination-atop', 'destination-in', 'destination-out', 'destination-over', 'difference', 'exclusion', 'hard-light', 'hue', 'lighten', 'lighter', 'luminosity', 'multiply', 'overlay', 'saturation', 'screen', 'soft-light', 'source-atop', 'source-in', 'source-out', 'source-over', 'xor']

const operations: Operation[] = []
function add(id: string, name: string, inputs: Socket[], outputs: Socket[], compute: Operation['compute'], fields: Field[] = inputs.filter(i => i.defaultValue !== undefined)) {
    operations.push({ id, name, inputs, outputs, fields, compute })
}
add('basic.source', 'Source', [socket('url', 'Url', 'string')], outputImage, async (v, s) => ({
    image: v.url != null ? await image.imageURLToImage(v.url) : s.image ?? null
}))
add('basic.display', 'Display', [inputImage], outputImage, async v => ({ image: v.image }))
add('basic.properties', 'Properties', [inputImage], [number('width', 'Width'), number('height', 'Height')], async v => ({ width: image.imageWidth(v.image), height: image.imageHeight(v.image) }))

const filters: [string, string, string, number, (img: image.ProcessingImage, amount: number) => Promise<HTMLCanvasElement>][] = [
    ['greyscale', 'Greyscale', 'amount', 100, image.filterGrayScale],
    ['blur', 'Blur', 'radius', 10, image.filterBlur],
    ['invert', 'Invert', 'amount', 100, image.filterInvert],
    ['sepia', 'Sepia', 'amount', 100, image.filterSepia],
    ['saturate', 'Saturate', 'amount', 100, image.filterSaturate],
    ['opacity', 'Opacity', 'amount', 50, image.filterOpacity],
    ['contrast', 'Contrast', 'amount', 200, image.filterContrast],
    ['brightness', 'Brightness', 'amount', 200, image.filterBrightness],
    ['hue-rotate', 'Hue rotate', 'amount', 90, image.filterHueRotate]
]
for (const [id, name, field, initial, fn] of filters) {
    add(`filter.${id}`, name, [inputImage, number(field, field === 'radius' ? 'Radius (px)' : id === 'hue-rotate' ? 'Amount (degrees)' : 'Amount (%)', initial)], outputImage,
        async v => ({ image: await fn(v.image, v[field]) }))
}
add('filter.tint', 'Tint', [inputImage, socket('color', 'Color', 'color', '#f47710')], outputImage, async v => ({ image: await image.filterTint(v.image, v.color) }))

add('transform.mirror', 'Mirror', [inputImage], outputImage, async (v, s) => ({ image: await image.mirrorImage(v.image, s.axis) }), [
    { ...socket('axis', 'Axis', 'string', 'x'), options: ['x', 'y', 'x_y'] }
])
add('transform.blend', 'Blend', [socket('image1', 'Image', 'image'), socket('image2', 'Image', 'image')], outputImage,
    async (v, s) => ({ image: await image.blendImages(v.image1, v.image2, s.operation) }), [
        { ...socket('operation', 'Mode', 'string', 'multiply'), options: compositeOperations }
    ])
add('transform.clip', 'Clip', [inputImage, socket('mask', 'Mask', 'image')], outputImage, async v => ({ image: await image.clipImage(v.image, v.mask) }))
add('transform.resize', 'Resize', [inputImage, number('width', 'Width', 150), number('height', 'Height', 150)], outputImage,
    async v => ({ image: await image.resizeImage(v.image, dimension(v.width), dimension(v.height)) }))
add('transform.crop', 'Crop', [inputImage, number('width', 'Width', 150), number('height', 'Height', 150), number('x', 'X', 0), number('y', 'Y', 0)], outputImage,
    async v => ({ image: await image.cropImage(v.image, v.x, v.y, dimension(v.width), dimension(v.height)) }))
add('transform.overlay', 'Overlay', [inputImage, socket('overlay', 'Overlay', 'image'), number('x', 'X', 0), number('y', 'Y', 0)], outputImage,
    async v => ({ image: await image.overlayImage(v.image, v.overlay, v.x, v.y) }))
add('transform.threshold', 'Threshold', [inputImage, number('threshold', 'Threshold', 127), number('value', 'Value', 255)], outputImage,
    async v => ({ image: await image.imageThreshold(v.image, v.threshold, v.value) }))

for (const [id, name, type, value] of [
    ['text', 'Text', 'string', ''], ['boolean', 'Boolean', 'boolean', false],
    ['color', 'Color', 'color', '#f47710'], ['number', 'Number', 'number', 0]
] as const) {
    add(`input.${id}`, name, [], [socket('value', name, type)], async (_v, s) => ({ value: type === 'number' ? finiteNumber(s.value) : s.value }), [socket('value', name, type, value)])
}
for (const [id, name, fn] of [
    ['add', 'Add', (a: number, b: number) => a + b],
    ['subtract', 'Subtract', (a: number, b: number) => a - b],
    ['multiply', 'Multiply', (a: number, b: number) => a * b],
    ['divide', 'Divide', (a: number, b: number) => a / b]
] as const) {
    add(`math.${id}`, name, [number('a', 'A'), number('b', 'B')], [number('result', 'Result')], async v => ({ result: finiteNumber(fn(v.a, v.b)) }))
}

export function finiteNumber(value: unknown): number {
    if (value === '' || value == null || !Number.isFinite(Number(value))) throw new Error('Enter a finite number.')
    return Number(value)
}
function dimension(value: unknown): number {
    const n = finiteNumber(value)
    if (n < 1 || Math.round(n) !== n) throw new Error('Image dimensions must be positive whole numbers.')
    return n
}
export const groups = ['basic', 'filter', 'transform', 'input', 'math']
export const catalog = Object.fromEntries(operations.map(o => [o.id, o])) as Record<string, Operation>

export function nodeData(type: string): Record<string, any> {
    const op = catalog[type]
    return { type, label: op.name, ...Object.fromEntries(op.fields.map(f => [f.id, f.defaultValue])) }
}
