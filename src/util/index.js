const path = require('path');

module.exports = {
  // TODO: better function name
  convert(sourceAmount, sourceUnit, targetUnit) {
    // TODO: lowercase
    const unitList = ['KB', 'MB', 'GB'];
    const sourceIndex = unitList.indexOf(sourceUnit);
    if (sourceIndex === -1) { /* TODO: handle exception */ }
    const targetIndex = unitList.indexOf(targetUnit);
    if (targetIndex === -1) { /* TODO: handle exception */ }
    const power = sourceIndex - targetIndex;

    return sourceAmount * (1024 ** power);
  },
  dataUriToBuffer(dataUri) {
    const base64String = dataUri.slice(dataUri.indexOf(',') + 1);
    const buffer = Buffer.from(base64String, 'base64');

    return buffer;
  },
  imageToDataUri(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);

    return canvas.toDataURL();
  },
  projectRoot(pathSegment) {
    path.resolve(__dirname, '..', pathSegment);
  },
};
