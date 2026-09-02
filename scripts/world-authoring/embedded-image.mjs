import jpeg from 'jpeg-js';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const DATA_IMAGE = /^data:(image\/(?:png|jpeg));base64,(.+)$/s;

function decodeDataImage(url, label) {
  const match = DATA_IMAGE.exec(url);
  if (!match) {
    const mime = /^data:([^;,]+)/.exec(url)?.[1] ?? 'unknown';
    throw new Error(`Image ${label} uses unsupported embedded format ${mime}; use PNG or JPEG.`);
  }
  const encoded = Buffer.from(match[2], 'base64');
  try {
    const decoded = match[1] === 'image/png' ? PNG.sync.read(encoded) : jpeg.decode(encoded, { useTArray: true });
    return { data: Array.from(decoded.data), width: decoded.width, height: decoded.height, type: 'Uint8Array' };
  } catch (error) {
    throw new Error(`Cannot decode embedded image ${label}: ${error.message}`);
  }
}

export function normalizeEmbeddedImages(document) {
  for (const image of document.images ?? []) {
    const label = image.name ?? image.uuid ?? '<unknown>';
    const urls = Array.isArray(image.url) ? image.url : [image.url];
    const normalized = urls.map(url => {
      if (typeof url !== 'string') return url;
      if (url.startsWith('data:')) return decodeDataImage(url, label);
      if (/^(blob:|https?:|\.\.?\/)/i.test(url)) throw new Error(`Image ${label} uses unresolved URL "${url}". Embed the image in the Editor export.`);
      throw new Error(`Image ${label} has unsupported URL "${url}". Embed it as PNG or JPEG.`);
    });
    image.url = Array.isArray(image.url) ? normalized : normalized[0];
  }
}
