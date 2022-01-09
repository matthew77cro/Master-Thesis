const imageUtils = require('./image');

// Assumptions: QR code is not mirrored in any way, just rotated and perspective transformed; there is only one QR per image;

const aproxSquare = (width, height) => Math.abs(width - height) / width < 0.1 && Math.abs(width - height) / height < 0.1;
const aproxEquals = (moduleSize1, moduleSize2, x1, y1,x2, y2) => 
    Math.abs(x1 - x2) <= 5 * Math.min(moduleSize1, moduleSize2) &&
    Math.abs(y1 - y2) <= 5 * Math.min(moduleSize1, moduleSize2) &&
    Math.abs(moduleSize1 - moduleSize2) < Math.min(moduleSize1, moduleSize2);
const distance = (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

// Looking for 1:1:3:1:1 with allowed deviation of max 10%
const possibleQrFinderPattern = (scan) => {
    if (scan.length < 5)
        return [];
    
    const possiblePositions = [];
    
    for (let i = 0; i + 5 <= scan.length; i++) {
        const moduleSize = (scan[i] + scan[i + 1] + scan[i + 2] + scan[i + 3] + scan[i + 4]) / 7;
        const allowedDeviation = moduleSize / 10;
        
        if (Math.abs(moduleSize - scan[i]) <= allowedDeviation &&
            Math.abs(moduleSize - scan[i + 1]) <= allowedDeviation &&
            Math.abs(3 * moduleSize - scan[i + 2]) <= allowedDeviation &&
            Math.abs(moduleSize - scan[i + 3]) <= allowedDeviation &&
            Math.abs(moduleSize - scan[i + 4]) <= allowedDeviation) {
                possiblePositions.push(i);
            }
    }

    return possiblePositions;
};

// Looking for line segment intersections, filtering ones that are not aprox. square, merging ones that are aprox. equal
const filterPossibleQrCodeScans = (possibleHorizontal, possibleVertical) => {
    // Intersections
    const positions = [];

    for (let horiz of possibleHorizontal) {
        for (let vert of possibleVertical) {
            if (vert.yStart < horiz.y && horiz.y < vert.yEnd &&
                horiz.xStart < vert.x && vert.x < horiz.xEnd)
                positions.push({
                    xUpperLeft: horiz.xStart,
                    yUpperLeft: vert.yStart,
                    width: horiz.xEnd - horiz.xStart,
                    height: vert.yEnd - vert.yStart,
                });
        }
    }

    // Filtering only aprox. squares
    const filtered = [];

    for (let position of positions) {
        if (aproxSquare(position.width, position.height))
            filtered.push(position);
    }

    // Filtering aprox. equal
    const filtered2 = [];

    for (let f1 of filtered) {
        const moduleSize = Math.min(f1.width / 7, f1.height / 7);

        let similar = false;
        for (let f2 of filtered2) {
            const moduleSize2 = Math.min(f2.width / 7, f2.height / 7);

            if (aproxEquals(moduleSize, moduleSize2, f1.xUpperLeft, f1.yUpperLeft, f2.xUpperLeft, f2.yUpperLeft)) {
                similar = true;
                break;
            }
        }

        if (similar)
            continue;
        
        filtered2.push(f1);
    }

    return filtered2;
};

// Returns 3 best locations, i.e. those that have similar module size and form a shape closer to an isosceles right-angled triangle
const findBestQrFinderPatternLocations = (possibleLocations) => {
    if (possibleLocations.length < 3)
        return null;
    
    let difference = Number.MAX_SAFE_INTEGER;
    let qr1 = null, qr2 = null, qr3 = null;

    for (let i = 0; i < possibleLocations.length - 2; i++) {
        const fp1 = possibleLocations[i];
        const moduleSize1 = Math.min(fp1.width / 7, fp1.height / 7);

        for (let j = i + 1; j < possibleLocations.length - 1; j++) {
            const fp2 = possibleLocations[j];
            const moduleSize2 = Math.min(fp2.width / 7, fp2.height / 7);
            const dist = distance(fp1.xUpperLeft, fp1.yUpperLeft, fp2.xUpperLeft, fp2.yUpperLeft);

            for (let k = j + 1; k < possibleLocations.length; k++) {
                const fp3 = possibleLocations[k];
                const moduleSize3 = Math.min(fp3.width / 7, fp3.height / 7);
                const minModuleSize = Math.min(Math.min(moduleSize1, moduleSize2), moduleSize3);
                const maxModuleSize = Math.max(Math.max(moduleSize1, moduleSize2), moduleSize3);
                if (maxModuleSize > minModuleSize * 1.4)
                    continue; // module sizes too different

                let a = dist;
                let b = distance(fp1.xUpperLeft, fp1.yUpperLeft, fp3.xUpperLeft, fp3.yUpperLeft);
                let c = distance(fp2.xUpperLeft, fp2.yUpperLeft, fp3.xUpperLeft, fp3.yUpperLeft);

                // sort a, b, c ascending
                if (a < b) {
                    if (b > c) {
                        if (a < c) {
                            let temp = b;
                            b = c;
                            c = temp;
                        } else {
                            let temp = a;
                            a = c;
                            c = b;
                            b = temp;
                        }
                    }
                } else {
                    if (b < c) {
                        if (a < c) {
                            let temp = a;
                            a = b;
                            b = temp;
                        } else {
                            let temp = a;
                            a = b;
                            b = c;
                            c = temp;
                        }
                    } else {
                        let temp = a;
                        a = c;
                        c = temp;
                    }
                }

                const diff = Math.abs(c - 2*b) + Math.abs(c - 2*a);
                if (diff < difference) {
                    difference = diff;
                    qr1 = fp1;
                    qr2 = fp2;
                    qr3 = fp3;
                }
            }
        }
    }

    return { qr1, qr2, qr3 };

};

module.exports.findQr = (image) => {
    if(image.metadata.channels != 1)
        return null;
    
    const width = image.metadata.width;
    const height = image.metadata.height;

    const possibleHorizontal = [];
    const possibleVertical = [];

    // Finding with horizontal scan lines
    for (let y = 0; y < height; y++) {
        const scan = [0];
        const scanXCoordinates = [0];
        
        let mode = imageUtils.getLuminance(image, 0, y);           // 0 - black pixels, 255 - white pixels
        for (let x = 0; x < width; x++) {
            let pixelY = imageUtils.getLuminance(image, x, y);
            if (mode != pixelY) {
                mode = pixelY;
                scan.push(1);
                scanXCoordinates.push(x);
            } else {
                scan[scan.length - 1]++;
            }
        }

        possibleQrFinderPattern(scan).forEach((index) => {
            possibleHorizontal.push({
                xStart: scanXCoordinates[index],
                xEnd: scanXCoordinates[index] + scan[index] + scan[index + 1] + scan[index + 2] + scan[index + 3] + scan[index + 4],
                y
            });
        });
    }

    // Finding with vertical scan lines
    for (let x = 0; x < width; x++) {
        const scan = [0];
        const scanYCoordinates = [0];
        
        let mode = imageUtils.getLuminance(image, x, 0);           // 0 - black pixels, 255 - white pixels
        for (let y = 0; y < height; y++) {
            let pixelY = imageUtils.getLuminance(image, x, y);
            if (mode != pixelY) {
                mode = pixelY;
                scan.push(1);
                scanYCoordinates.push(y);
            } else {
                scan[scan.length - 1]++;
            }
        }

        possibleQrFinderPattern(scan).forEach((index) => {
            possibleVertical.push({
                x,
                yStart: scanYCoordinates[index],
                yEnd: scanYCoordinates[index] + scan[index] + scan[index + 1] + scan[index + 2] + scan[index + 3] + scan[index + 4]
            });
        });
    }

    const possibleQrFinderPatternLocations = filterPossibleQrCodeScans(possibleHorizontal, possibleVertical);
    console.log(possibleQrFinderPatternLocations);
    const bestLocations = findBestQrFinderPatternLocations(possibleQrFinderPatternLocations);

    return bestLocations;
};