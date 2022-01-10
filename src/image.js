const sharp = require('sharp');

module.exports = async (fileName) => {
    const image = sharp(fileName);
    const buffer = await image.raw().toBuffer();
    const metadata = await image.metadata();
    return { buffer, metadata: { width: metadata.width, height: metadata.height, channels: metadata.channels } };
};

const saveRaw = async (image, fileName) => {
    await sharp(image.buffer, {
            raw: {
                width: image.metadata.width,
                height: image.metadata.height,
                channels: image.metadata.channels
            }
    }).toFile(fileName);
};

// Extracts the RGB value for the pixel in (x, y) position
const getRGB = (image, x, y) => {
    if (image.metadata.channels != 3)
        return null;

    const width = image.metadata.width;
    const height = image.metadata.height;

    if (x >= width || y >= height)
        return null;

    return {
        r: image.buffer[(y * width + x) * 3],
        g: image.buffer[(y * width + x) * 3 + 1],
        b: image.buffer[(y * width + x) * 3 + 2],
    };
};

// Converts RGB to luminance component (Y in YUV) for the pixel in (x, y) position
const getLuminanceFromRGB = (image, x, y) => {
    if (image.metadata.channels != 3)
        return;
    
    const rgb = getRGB(image, x, y);
    let luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.144 * rgb.b;
    if (luminance > 255)
        luminance = 255;
    return Math.round(luminance);
};

// Extracts the luminance component for the pixel in (x, y) position
const getLuminance = (image, x, y) => {
    if (image.metadata.channels != 1)
        return;
    
    return image.buffer[y * image.metadata.width + x];
};

const grayscale = (image) => {
    if (image.metadata.channels != 3)
        return null;
    
    const width = image.metadata.width;
    const height = image.metadata.height;

    const buffer = [];
    for(let y = 0; y < height; y++) {
        for(let x = 0; x < width; x++) {
            buffer.push(getLuminanceFromRGB(image, x, y));
        }
    }

    return { buffer: Buffer.from(buffer), metadata: { ...image.metadata, channels: 1 } };
};

/*const binarization = (image) => {
    if (image.metadata.channels != 3)
        return null;

    const gray = grayscale(image);

    let mean = 0;
    gray.buffer.forEach((value) => mean += value);
    mean /= gray.buffer.length;

    let stdev = 0;
    gray.buffer.forEach((value) => stdev += (value - mean) * (value - mean));
    stdev = Math.sqrt(stdev / gray.buffer.length);

    const T = mean * (1 + 0.5 * (1 - stdev / 128));

    for(let i = 0; i < gray.buffer.length; i++) {
        if(gray.buffer[i] < T) {
            gray.buffer[i] = 0;
        } else {
            gray.buffer[i] = 255;
        }
    }

    return gray;
};*/

const binarization = (image, regionWidth, regionHeight) => {
    if (image.metadata.channels != 3 || regionWidth > image.metadata.width || regionHeight > image.metadata.height)
        return null;
    
    const gray = grayscale(image);

    const regionsInWidth = Math.ceil(gray.metadata.width / regionWidth);
    const regionsInHeight = Math.ceil(gray.metadata.height / regionHeight);

    const getPixelValueInRegion = (regionI, regionJ, x, y) => {
        if (regionI >= regionsInHeight || regionJ >= regionsInWidth || x >= regionWidth || y >= regionHeight ||
                regionI < 0 || regionJ < 0 || x < 0 || y < 0)
            return;

        return gray.buffer[regionI * gray.metadata.width * regionHeight + regionJ * regionWidth + y * gray.metadata.width + x];
    }

    const setPixelValueInRegion = (regionI, regionJ, x, y, value) => {
        if (regionI >= regionsInHeight || regionJ >= regionsInWidth || x >= regionWidth || y >= regionHeight ||
                regionI < 0 || regionJ < 0 || x < 0 || y < 0)
            return;

        gray.buffer[regionI * gray.metadata.width * regionHeight + regionJ * regionWidth + y * gray.metadata.width + x] = value;
    }

    for (let i = 0; i < regionsInHeight; i++) {
        for (let j = 0; j < regionsInWidth; j++) {

            let mean = 0;

            for (let y = 0; y < regionHeight && i * regionHeight + y < gray.metadata.height; y++) {
                for (let x = 0; x < regionWidth && j * regionWidth + x < gray.metadata.width; x++) {
                    mean += getPixelValueInRegion(i, j, x, y);
                }
            }
            mean /= (regionHeight*regionWidth);

            for (let y = 0; y < regionHeight && i * regionHeight + y < gray.metadata.height; y++) {
                for (let x = 0; x < regionWidth && j * regionWidth + x < gray.metadata.width; x++) {
                    if (getPixelValueInRegion(i, j, x, y) < mean) {
                        setPixelValueInRegion(i, j, x, y, 0);
                    } else {
                        setPixelValueInRegion(i, j, x, y, 255);
                    }
                }
            }

        }
    }

    return gray;
};

Object.assign(module.exports, {
    saveRaw,
    getRGB,
    getLuminanceFromRGB,
    getLuminance,
    grayscale,
    binarization,
});