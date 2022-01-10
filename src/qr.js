const imageUtils = require('./image');

// Assumptions: QR code is not mirrored in any way, just rotated and perspective transformed; there is only one QR per image;

const aproxEquals = (moduleSize1, moduleSize2, x1, y1,x2, y2) => 
    Math.abs(x1 - x2) < Math.min(moduleSize1, moduleSize2) &&
    Math.abs(y1 - y2) < Math.min(moduleSize1, moduleSize2) &&
    Math.abs(moduleSize1 - moduleSize2) < Math.min(moduleSize1, moduleSize2);
const distance = (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

// Looking for 1:1:3:1:1 with allowed deviation of max @maxVariance per module
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

// For each scan that is aprox the pattern, do a vertical check to find centerX, do another horizontal to find centerY, do a diagonal from calculated center to confirm; lastly merging ones that are aprox. equal
const findPossibleFinderPatternLocations = (image, possibleFinderPatternLocations, yCoord, horizScan, scanXCoordinates) => {
    const possiblePositions = possibleQrFinderPattern(horizScan, 0.5);

    for (let position of possiblePositions) {
        const leftX = scanXCoordinates[position];
        const rightX = leftX + horizScan[position] + horizScan[position + 1] + horizScan[position + 2] + horizScan[position + 3] + horizScan[position + 4];
        const estimatedModuleSize = Math.round((rightX - leftX) / 7);
        const centerOffset = Math.ceil((rightX - leftX) / 2);
        
        // Vertical check
        const possibleVerticalPositions = [];
        for (let x = leftX; x < rightX; x++) {
            const scan = [0];
            const scanYCoordinates = [yCoord - centerOffset];

            let mode = imageUtils.getLuminance(image, x, yCoord - centerOffset);    // 0 - black pixels, 255 - white pixels
            for (let y = yCoord - centerOffset; y > 0 && y < image.metadata.height && y <= yCoord + centerOffset; y++) {
                const pixelY = imageUtils.getLuminance(image, x, y);
                if (mode != pixelY) {
                    mode = pixelY;
                    scan.push(1);
                    scanYCoordinates.push(y);
                } else {
                    scan[scan.length - 1]++;
                }
            }

            const patternFinds = possibleQrFinderPattern(scan, 0.5);

            for (let patternFind of patternFinds) {
                const patternLen = scan[patternFind] + scan[patternFind + 1] + scan[patternFind + 2] + scan[patternFind + 3] + scan[patternFind + 4];
                const moduleSize = Math.round(patternLen / 7);
                // module sizes must be less than 40% different
                if (Math.abs(moduleSize - estimatedModuleSize) / estimatedModuleSize >= 0.4)
                    continue;
                possibleVerticalPositions.push({ x, yStart: scanYCoordinates[patternFind] });
            }
        }
        if (possibleVerticalPositions.length === 0)
            continue;
        const centerX = Math.round(possibleVerticalPositions.reduce((a, b) => a + b.x, 0) / possibleVerticalPositions.length);

        // Horizontal check
        const startYCheck = Math.floor(possibleVerticalPositions.reduce((a, b) => a + b.yStart, 0) / possibleVerticalPositions.length);
        const endYCheck = startYCheck + (rightX - leftX);
        const possibleHorizontalPositions = [];
        for (let y = startYCheck; y < endYCheck; y++) {
            const scan = [0];
            const scanXCoordinates = [centerX - centerOffset];

            let mode = imageUtils.getLuminance(image, centerX - centerOffset, y);    // 0 - black pixels, 255 - white pixels
            for (let x = centerX - centerOffset; x > 0 && x < image.metadata.width && x <= centerX + centerOffset; x++) {
                let pixelY = imageUtils.getLuminance(image, x, y);
                if (mode != pixelY) {
                    mode = pixelY;
                    scan.push(1);
                    scanXCoordinates.push(x);
                } else {
                    scan[scan.length - 1]++;
                }
            }

            const patternFinds = possibleQrFinderPattern(scan, 0.5);

            for (let patternFind of patternFinds) {
                const patternLen = scan[patternFind] + scan[patternFind + 1] + scan[patternFind + 2] + scan[patternFind + 3] + scan[patternFind + 4];
                const moduleSize = Math.round(patternLen / 7);
                // module sizes must be less than 40% different
                if (Math.abs(moduleSize - estimatedModuleSize) / estimatedModuleSize >= 0.4)
                    continue;
                    possibleHorizontalPositions.push({ y, xStart: scanXCoordinates[patternFind] });
            }
        }
        if (possibleHorizontalPositions.length === 0)
            continue;
        const centerY = Math.round(possibleHorizontalPositions.reduce((a, b) => a + b.y, 0) / possibleHorizontalPositions.length);

        // From center to north west diagonally searching for corner of finder pattern
        let diagonalStartX = centerX, diagonalStartY = centerY;
        let changeCounter = 3;
        let lastColor = imageUtils.getLuminance(image, diagonalStartX, diagonalStartY);
        while (changeCounter > 0 && diagonalStartX >= 0 && diagonalStartY >= 0) {
            diagonalStartX--;
            diagonalStartY--;

            let newColor = imageUtils.getLuminance(image, diagonalStartX, diagonalStartY);
            if (lastColor !== newColor)
                changeCounter--;
            lastColor = newColor;
        }
        diagonalStartX++; diagonalStartY++;
        if (changeCounter !== 0)
            continue;

        // Filtering with diagonal scan
        const scanDiag = [0, 0, 0, 0, 0];
        let index = 0;
        let mode = imageUtils.getLuminance(image, diagonalStartX, diagonalStartY);
        for (let x = diagonalStartX, y = diagonalStartY; x < image.metadata.width && y < image.metadata.height; x++, y++) {
            let pixelY = imageUtils.getLuminance(image, x, y);
            if (mode != pixelY) {
                mode = pixelY;
                index++;

                if (index === scanDiag.length)
                    break;
            } else {
                scanDiag[index]++;
            }
        }
        if (possibleQrFinderPattern(scanDiag, 0.5).length === 0)
            continue;
        
        // Merge if similar
        let similar = false;
        for (let location of possibleFinderPatternLocations) {
            const div = location.similar;

            if (aproxEquals(estimatedModuleSize, location.estimatedModuleSize / div, centerX, centerY, location.centerX / div, location.centerY / div)) {
                similar = true;

                location.estimatedModuleSize += estimatedModuleSize;
                location.centerX += centerX;
                location.centerY += centerY;
                location.similar++;

                break;
            }
        }
        
        if (!similar)
            possibleFinderPatternLocations.push({ centerX, centerY, estimatedModuleSize, similar: 1 });
    }
};

// Returns 3 best locations, i.e. those that have similar module size and form a shape closer to an isosceles right-angled triangle
const findBestFinderPatternLocations = (possibleLocations) => {
    if (possibleLocations.length < 3)
        return null;
    
    let difference = Number.MAX_SAFE_INTEGER;
    let qr1 = null, qr2 = null, qr3 = null;

    for (let i = 0; i < possibleLocations.length - 2; i++) {
        const fp1 = possibleLocations[i];
        const moduleSize1 = fp1.estimatedModuleSize;

        for (let j = i + 1; j < possibleLocations.length - 1; j++) {
            const fp2 = possibleLocations[j];
            const moduleSize2 = fp2.estimatedModuleSize;
            const dist = distance(fp1.centerX, fp1.centerY, fp2.centerX, fp2.centerY);

            for (let k = j + 1; k < possibleLocations.length; k++) {
                const fp3 = possibleLocations[k];
                const moduleSize3 = fp3.estimatedModuleSize;
                
                const minModuleSize = Math.min(Math.min(moduleSize1, moduleSize2), moduleSize3);
                const maxModuleSize = Math.max(Math.max(moduleSize1, moduleSize2), moduleSize3);
                if (maxModuleSize !== minModuleSize)
                    continue; // module sizes too different

                let a = dist;
                let b = distance(fp1.centerX, fp1.centerY, fp3.centerX, fp3.centerY);
                let c = distance(fp2.centerX, fp2.centerY, fp3.centerX, fp3.centerY);

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

    const possibleFinderPatternLocations = [];

    // Finding with horizontal scan lines
    for (let y = 0; y < height; y++) {
        const horizScan = [0];
        const scanXCoordinates = [0];
        
        let mode = imageUtils.getLuminance(image, 0, y);           // 0 - black pixels, 255 - white pixels
        for (let x = 0; x < width; x++) {
            let pixelY = imageUtils.getLuminance(image, x, y);
            if (mode != pixelY) {
                mode = pixelY;
                horizScan.push(1);
                scanXCoordinates.push(x);
            } else {
                horizScan[horizScan.length - 1]++;
            }
        }

        findPossibleFinderPatternLocations(image, possibleFinderPatternLocations, y, horizScan, scanXCoordinates);
    }

    possibleFinderPatternLocations.forEach((location) => {
        location.estimatedModuleSize = Math.round(location.estimatedModuleSize / location.similar);
        location.centerX = Math.round(location.centerX / location.similar);
        location.centerY = Math.round(location.centerY / location.similar);
        delete location.similar;
    })

    console.log(possibleFinderPatternLocations);
    const bestLocations = findBestFinderPatternLocations(possibleFinderPatternLocations);

    return bestLocations;
};