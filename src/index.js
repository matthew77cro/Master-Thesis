const image = require('./image');
const qr = require('./qr');

( async () => {

    const img = await image('resources/img.jpg')
    const binarized = image.binarization(img, img.metadata.width, img.metadata.height);
    const qrFinderLocations = qr.findQr(binarized);
    console.log(qrFinderLocations);
    // const transformed = image.transformQr(binarized, possibleQrFinderPatternLocations);
    // const qr = image.readQr(transformed);
    // TODO za diplomski rad: const decoded = image.decode(qr);

})();