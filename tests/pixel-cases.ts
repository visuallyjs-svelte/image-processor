import * as p from '../src/processing'
import { compositeOperations } from '../src/catalog'

// Both paths start from decoded PNGs, just like uploaded source images.
export async function pixelCases() {
    const inputs = await Promise.all([0, 1].map(async offset => {
        const c = document.createElement('canvas'); c.width = 8; c.height = 6
        const ctx = c.getContext('2d')!
        const data = ctx.createImageData(8, 6)
        for (let i = 0; i < data.data.length; i += 4) {
            data.data[i] = (i * 17 + offset * 43) % 256
            data.data[i + 1] = (i * 7 + offset * 81) % 256
            data.data[i + 2] = (i * 11 + offset * 23) % 256
            data.data[i + 3] = [0, 32, 80, 127, 192, 255][(i / 4 + offset) % 6]
        }
        ctx.putImageData(data, 0, 0)
        return p.imageURLToImage(c.toDataURL())
    }))
    const [a, b] = inputs
    const cases: Record<string, () => Promise<HTMLImageElement | HTMLCanvasElement>> = {}
    for (const [name, fn] of [
        ['invert', p.filterInvert], ['sepia', p.filterSepia], ['greyscale', p.filterGrayScale],
        ['saturate', p.filterSaturate], ['opacity', p.filterOpacity], ['blur', p.filterBlur],
        ['hue', p.filterHueRotate], ['contrast', p.filterContrast], ['brightness', p.filterBrightness]
    ] as const) for (const amount of [0, 37, 100]) cases[`${name}-${amount}`] = () => fn(a, amount)
    cases.tint = () => p.filterTint(a, '#f47710')
    for (const axis of ['x', 'y', 'x_y'] as const) cases[`mirror-${axis}`] = () => p.mirrorImage(a, axis)
    for (const mode of compositeOperations) cases[`blend-${mode}`] = () => p.blendImages(a, b, mode as GlobalCompositeOperation)
    cases.clip = () => p.clipImage(a, b)
    cases.crop = () => p.cropImage(a, 1, 2, 5, 3)
    cases.resize = () => p.resizeImage(a, 5, 9)
    cases.overlay = () => p.overlayImage(a, b, 2, -1)
    cases.threshold = () => p.imageThreshold(a, 127, 200)
    cases.chain = async () => p.filterInvert(await p.filterOpacity(await p.filterSepia(a, 37), 71), 80)
    return cases
}

export async function collectPixels() {
    const results: Record<string, { width: number; height: number; pixels: number[] }> = {}
    for (const [name, fn] of Object.entries(await pixelCases())) {
        const image = await fn()
        const width = 'naturalWidth' in image ? image.naturalWidth : image.width
        const height = 'naturalHeight' in image ? image.naturalHeight : image.height
        const c = document.createElement('canvas'); c.width = width; c.height = height
        const ctx = c.getContext('2d')!; ctx.drawImage(image, 0, 0)
        results[name] = { width, height, pixels: [...ctx.getImageData(0, 0, width, height).data] }
    }
    return results
}
