import { imageWidth, imageHeight, type ProcessingImage } from './canvas-util'

/** Local copy adapted from @jsplumb/canvas-image-processing (MIT; see LICENSE). */
const images = new Map<string, Promise<HTMLImageElement>>()

export function imageURLToImage(url: string): Promise<HTMLImageElement> {
    if (!url) return Promise.reject(new Error('An image URL is required.'))
    const cached = images.get(url)
    if (cached) return cached
    const pending = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        const timeout = window.setTimeout(() => fail(), 15000)
        const clean = () => { clearTimeout(timeout); img.onload = null; img.onerror = null }
        const fail = () => { clean(); reject(new Error('Could not load image. Remote images must allow cross-origin access.')) }
        img.crossOrigin = 'anonymous'
        img.onload = () => { clean(); resolve(img) }
        img.onerror = fail
        img.src = url
    })
    images.set(url, pending)
    pending.catch(() => images.delete(url))
    if (images.size > 32) images.delete(images.keys().next().value!)
    return pending
}

export async function readImageFromFile(file: File): Promise<HTMLImageElement> {
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
    const url = URL.createObjectURL(file)
    try {
        return await imageURLToImage(url)
    } finally {
        images.delete(url)
        URL.revokeObjectURL(url)
    }
}

export function imageToDataURL(img: ProcessingImage): string {
    return imageCanvas(img).toDataURL('image/png')
}

export function imageToBlob(img: ProcessingImage): Promise<Blob> {
    return new Promise((resolve, reject) => {
        imageCanvas(img).toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not export PNG.')), 'image/png')
    })
}

function imageCanvas(img: ProcessingImage): HTMLCanvasElement {
    if (img instanceof HTMLCanvasElement) return img
    const canvas = document.createElement('canvas')
    canvas.width = imageWidth(img)
    canvas.height = imageHeight(img)
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    return canvas
}
