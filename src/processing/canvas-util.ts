import { TAG_CANVAS, TWO_D } from './definitions'

/** Decoded sources and immutable per-operation canvases stay in memory. */
export type ProcessingImage = HTMLImageElement | HTMLCanvasElement

export const imageWidth = (image: ProcessingImage): number => 'naturalWidth' in image ? image.naturalWidth : image.width
export const imageHeight = (image: ProcessingImage): number => 'naturalHeight' in image ? image.naturalHeight : image.height
export const isProcessingImage = (value: unknown): value is ProcessingImage => value instanceof HTMLImageElement || value instanceof HTMLCanvasElement

/**
 * Sets the contents of a canvas element to the image represented by the given data URL.
 * @param canvas Canvas to draw into
 * @param url  URL to load. Maybe a data URL or an http[s]:// url.
 * @return a Promise that resolves to `true` once the image has been drawn into the canvas.
 */
export function setCanvasImageFromURL(canvas:HTMLCanvasElement, url:string, width?:number, height?:number):Promise<boolean> {

    return new Promise(function(resolve, reject) {
        const img = new Image()
        img.onerror = () => reject(new Error('Could not load image.'))
        img.onload = function() {

            const ctx = canvas.getContext(TWO_D)!
            ctx.save()

            if (width != null && height != null) {
                canvas.width = width
                canvas.height = height
                setCanvasImageFromImage(canvas, width, height, img)
            } else {
                ctx.drawImage(img, 0, 0)
            }

            ctx.restore()
            resolve(true)
        }
        img.src = url
    })
}

/**
 * Sets an image on a given canvas, setting the width/height of the canvas and scaling the image to fit. You do not need
 * to use this method if you don't wish to scale the canvas. You can just use the canvas's `drawImage` method instead.
 * @param canvas Canvas to draw into
 * @param img Image to draw
 * @param width Optional width for canvas. If null, the image width will be used.
 * @param height Optional height for canvas. If null, the image height will be used.
 * @param bgFill Color to use as background fill, defaults to white. You'll see a background fill if your image's dimensions are
 * in a different aspect ratio that defined by the width/height properties you provide.
 * @return true if successful, false if not.
 */
export function setCanvasImageFromImage(canvas:HTMLCanvasElement, width:number, height:number, img:ProcessingImage, bgFill?:string):boolean {

    let success = false
    const ctx = canvas.getContext("2d")!
    ctx.save()

    if (img != null) {

        ctx.fillStyle = bgFill || "white"
        ctx.fillRect(0,0,width,height)

        const scaleX = width / imageWidth(img)
        const scaleY = height / imageHeight(img)
        const minScale = Math.min(scaleX, scaleY)

        ctx.scale(minScale, minScale)
        const y = (height - (minScale * imageHeight(img))) / 2
        const x = (width - (minScale * imageWidth(img))) / 2

        ctx.drawImage(img, x / minScale, y / minScale);

        success = true
    }

    ctx.restore()

    return success
}

/**
 * Draw the given image into the given canvas, scaling the canvas so that the whole image fits.
 * @param canvas
 * @param img
 */
export function drawScaledImage(canvas:HTMLCanvasElement, img:ProcessingImage):void {
    const ctx = canvas.getContext("2d")!
    const scaleX = canvas.width / imageWidth(img)
    const scaleY = canvas.height / imageHeight(img)
    const minScale = Math.min(scaleX, scaleY)
    ctx.save()
    ctx.fillStyle = "white"
    ctx.fillRect(0,0,canvas.width,canvas.height)

    ctx.scale(minScale, minScale)
    const y = (canvas.height - (minScale * imageHeight(img))) / 2
    const x = (canvas.width - (minScale * imageWidth(img))) / 2

    ctx.drawImage(img, x/minScale, y/minScale);
    ctx.restore()
}


/**
 * Create a canvas which is the size of the given image. Does not draw the image into it.
 * @public
 * @param img
 */
export function createCanvas(img:ProcessingImage):HTMLCanvasElement {

    const w = img ? imageWidth(img) : 600,
        h = img ? imageHeight(img) : 600,
        fg = document.createElement(TAG_CANVAS)

    fg.width = w
    fg.height = h

    return fg
}
