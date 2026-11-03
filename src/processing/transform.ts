import {
    AXIS_X,
    AXIS_X_AND_Y,
    AXIS_Y,
    GLOBAL_COMPOSITE_MULTIPLY,
    GLOBAL_COMPOSITE_SOURCE_IN,
    TAG_CANVAS
} from "./definitions"
import { setCanvasImageFromImage, imageWidth, imageHeight, type ProcessingImage } from "./canvas-util"

/**
 * Flip the given image on either the horizontal or vertical axis, or both.
 * @param img Image to flip
 * @param axis Axis to flip on.
 */
export async function mirrorImage(img:ProcessingImage, axis:typeof AXIS_X | typeof AXIS_Y | typeof AXIS_X_AND_Y):Promise<HTMLCanvasElement> {
    const outputImage = document.createElement(TAG_CANVAS);
    outputImage.width = imageWidth(img);
    outputImage.height = imageHeight(img);

    const ctx = outputImage.getContext("2d")!;

    const dx = axis === AXIS_Y ? 1 : -1,
        x = axis === AXIS_Y ? 0 : -outputImage.width

    const dy = axis === AXIS_X ? 1 : -1,
        y = axis === AXIS_X ? 0 : -outputImage.height

    ctx.scale(dx, dy);

    // Draw the image on the canvas
    ctx.drawImage(img, x, y);

    return outputImage
}

/**
 * Apply a threshold operation to some image.
 * @param image
 * @param threshold
 * @param value
 */
export async function imageThreshold(image:ProcessingImage, threshold:number, value:number = 255):Promise<HTMLCanvasElement> {
    const outputImage = document.createElement(TAG_CANVAS);
    const ctx1 = outputImage.getContext("2d")!
    outputImage.width = imageWidth(image);
    outputImage.height = imageHeight(image);
    ctx1.drawImage(image, 0, 0)

    const data1 = ctx1.getImageData(0,0, imageWidth(image), imageHeight(image))

    for(let i = 0; i < data1.data.length; i += 4) {

        const red = data1.data[i]
        const green = data1.data[i + 1]
        const blue = data1.data[i + 2]

        data1.data[i] = red >= threshold ? value : 0
        data1.data[i+1] = green >= threshold ? value : 0
        data1.data[i+2] = blue>= threshold ? value : 0

    }
    ctx1.putImageData(data1, 0, 0)
    return outputImage
}

/**
 * Crop a section of an image.
 * @param image Image to crop
 * @param x Start position of crop in x axis
 * @param y Start position of crop in y axis
 * @param w Width of crop
 * @param h Height of crop
 */
export async function cropImage(image:ProcessingImage, x:number, y:number, w:number, h:number):Promise<HTMLCanvasElement> {

    const c1 = document.createElement(TAG_CANVAS)
    c1.width = w
    c1.height = h
    const ctx1 = c1.getContext("2d")!

    ctx1.drawImage(image, x, y, w, h, 0, 0, w, h)
    return c1
}

/**
 * Overlay an image onto some oher image
 * @param image1 Base image
 * @param image2 Image to overlay.
 * @param x Optional origin X for the overlay. Defaults to 0.
 * @param y Optional origin XY for the overlay. Defaults to 0.
 */
export async function overlayImage(image1:ProcessingImage, image2:ProcessingImage, x?:number, y?:number):Promise<HTMLCanvasElement> {

    const c1 = document.createElement(TAG_CANVAS)
    c1.width = imageWidth(image1)
    c1.height = imageHeight(image1)
    const ctx1 = c1.getContext("2d")!

    ctx1.drawImage(image1, 0, 0, c1.width, c1.height)
    ctx1.drawImage(image2, x || 0, y || 0, imageWidth(image2), imageHeight(image2))

    return c1
}

/**
 * Use an image as a mask to clip some other image.
 * @param image Image to clip
 * @param mask Image to use as a mask.
 */
export async function clipImage(image:ProcessingImage, mask:ProcessingImage):Promise<HTMLCanvasElement> {

    const c1 = document.createElement(TAG_CANVAS)
    const ctx1 = c1.getContext("2d")!
    c1.width = imageWidth(image)
    c1.height = imageHeight(image)

    ctx1.drawImage(mask, 0, 0)

    ctx1.globalCompositeOperation = GLOBAL_COMPOSITE_SOURCE_IN
    ctx1.drawImage(image, 0, 0)

    return c1
}

/**
 * Blend two images with a given composite mode, the default being `multiply`
 * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation for allowed blend modes.
 * @param image1 First image to blend - `destination` when using an applicable mode
 * @param image2 Second image to blend - `source` when using an applicable mode
 * @param blendMode Mode to use for blending. Defaults to `multiply`.
 */
export async function blendImages(image1:ProcessingImage, image2:ProcessingImage, blendMode?:GlobalCompositeOperation):Promise<HTMLCanvasElement> {

    const c1 = document.createElement(TAG_CANVAS)
    c1.width = imageWidth(image1)
    c1.height = imageHeight(image1)

    const ctx1 = c1.getContext("2d")!
    ctx1.drawImage(image1, 0, 0, c1.width, c1.height)

    ctx1.globalCompositeOperation = blendMode || GLOBAL_COMPOSITE_MULTIPLY
    ctx1.drawImage(image2, 0, 0, c1.width, c1.height)

    return c1
}


/**
 * Resize the image to the given width and height.
 * @param image
 * @param width
 * @param height
 */
export async function resizeImage(image:ProcessingImage, width:number, height:number):Promise<HTMLCanvasElement> {
    const c1 = document.createElement(TAG_CANVAS)
    c1.width = width
    c1.height = height
    setCanvasImageFromImage(c1, width, height, image)
    return c1
}
