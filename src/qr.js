const imageUtils = require('./image');

// Assumptions: QR code is not mirrored in any way, just rotated and perspective transformed; there is only one QR per image;

const aproxEquals = (moduleSize1, moduleSize2, x1, y1,x2, y2) => 
    Math.abs(x1 - x2) < Math.min(moduleSize1, moduleSize2) &&
    Math.abs(y1 - y2) < Math.min(moduleSize1, moduleSize2) &&
    Math.abs(moduleSize1 * 7 - moduleSize2 * 7) < Math.min(moduleSize1, moduleSize2);
const distance = (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

// Looking for 1:1:3:1:1 with allowed deviation of max 75% per module
const possibleQrFinderPattern = (scan, maxVariance) => {
    if (scan.length < 5)
        return [];
    
    const possiblePositions = [];
    
    for (let i = 0; i + 5 <= scan.length; i++) {
        const moduleSize = (scan[i] + scan[i + 1] + scan[i + 2] + scan[i + 3] + scan[i + 4]) / 7;
        if (moduleSize < 1)
            continue;

        const allowedDeviation = maxVariance * moduleSize;
        
        if (Math.abs(moduleSize - scan[i]) <= allowedDeviation &&
            Math.abs(moduleSize - scan[i + 1]) <= allowedDeviation &&
            Math.abs(3 * moduleSize - scan[i + 2]) <= 3 * allowedDeviation &&
            Math.abs(moduleSize - scan[i + 3]) <= allowedDeviation &&
            Math.abs(moduleSize - scan[i + 4]) <= allowedDeviation) {
                possiblePositions.push(i);
            }
    }

    return possiblePositions;
};

// Looking for line segment intersections filtering ones that are not aprox. square; filtering with diagonal scan; merging ones that are aprox. equal
const filterPossibleQrCodeScans = (image, possibleHorizontal, possibleVertical) => {
    // Intersections (filtering aprox. squares by comparing module sizes)
    const positions = [];
    for (let horiz of possibleHorizontal) {
        for (let vert of possibleVertical) {
            if (vert.yStart < horiz.y && horiz.y < vert.yEnd &&
                    horiz.xStart < vert.x && vert.x < horiz.xEnd &&
                    aproxEquals((horiz.xEnd - horiz.xStart) / 7, (vert.yEnd - vert.yStart) / 7, 0, 0, 0, 0))
                positions.push({
                    xUpperLeft: horiz.xStart,
                    yUpperLeft: vert.yStart,
                    width: horiz.xEnd - horiz.xStart + 1,
                    height: vert.yEnd - vert.yStart + 1,
                });
        }
    }

    // Filtering with diagonal scan
    const filtered2 = [];
    for (let f1 of positions) {
        const scan = [0];
        
        let mode = imageUtils.getLuminance(image, f1.xUpperLeft, f1.yUpperLeft);    // 0 - black pixels, 255 - white pixels
        for (let x = f1.xUpperLeft, y = f1.yUpperLeft; x < f1.xUpperLeft + f1.width && y < f1.yUpperLeft + f1.height; x++, y++) {
            let pixelY = imageUtils.getLuminance(image, x, y);
            if (mode != pixelY) {
                mode = pixelY;
                scan.push(1);
            } else {
                scan[scan.length - 1]++;
            }
        }

        for (let scanPos of possibleQrFinderPattern(scan, 0.75)) {
            let moduleSize = 0;

            for (let i = 0; i < 5; i++)
                moduleSize += scan[scanPos + i];
            moduleSize /= 7;

            if (aproxEquals(moduleSize, Math.min(f1.height / 7, f1.width / 7), 0, 0, 0, 0)) {
                filtered2.push(f1);
                break;
            }
        }
    }

    // Filtering aprox. equal
    const filtered3 = [];
    for (let f2 of filtered2) {
        const moduleSize2 = Math.min(f2.width / 7, f2.height / 7);

        let similar = false;
        let index = 0;
        for (let f3 of filtered3) {
            const moduleSize3 = Math.min(f3.width / 7, f3.height / 7);

            if (aproxEquals(moduleSize2, moduleSize3, f2.xUpperLeft, f2.yUpperLeft, f3.xUpperLeft, f3.yUpperLeft)) {
                similar = true;
                break;
            }

            index++;
        }

        if (similar) {
            filtered3[index].xUpperLeft += f2.xUpperLeft;
            filtered3[index].yUpperLeft += f2.yUpperLeft;
            filtered3[index].width += f2.width;
            filtered3[index].height += f2.height;
            filtered3[index].similarCount++;
        } else {
            filtered3.push({ ...f2, similarCount: 1});
        }
    }

    filtered3.forEach((value) => {        
        value.xUpperLeft = Math.round(value.xUpperLeft / value.similarCount);
        value.yUpperLeft = Math.round(value.yUpperLeft / value.similarCount);
        value.width = Math.round(value.width / value.similarCount);
        value.height = Math.round(value.height / value.similarCount);
        delete value.similarCount;
    });

    console.log(filtered3);

    return filtered3;
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

        possibleQrFinderPattern(scan, 0.5).forEach((index) => {
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

        possibleQrFinderPattern(scan, 0.5).forEach((index) => {
            possibleVertical.push({
                x,
                yStart: scanYCoordinates[index],
                yEnd: scanYCoordinates[index] + scan[index] + scan[index + 1] + scan[index + 2] + scan[index + 3] + scan[index + 4]
            });
        });
    }

    const possibleQrFinderPatternPositions = filterPossibleQrCodeScans(image, possibleHorizontal, possibleVertical);
    const bestLocations = findBestQrFinderPatternLocations(possibleQrFinderPatternPositions);

    return bestLocations;
};