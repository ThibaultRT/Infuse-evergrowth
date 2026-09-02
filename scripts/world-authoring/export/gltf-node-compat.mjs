import pngjs from 'pngjs';
const { PNG } = pngjs;

export function installGltfNodeCompat() {
  if (!globalThis.ImageData) globalThis.ImageData = class ImageData {
    constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
  };
  if (!globalThis.OffscreenCanvas) globalThis.OffscreenCanvas = class OffscreenCanvas {
    constructor(width = 1, height = 1) { this._width = width; this._height = height; this.pixels = new Uint8ClampedArray(width * height * 4); }
    get width() { return this._width; }
    set width(value) { this._width = value; this.pixels = new Uint8ClampedArray(this._width * this._height * 4); }
    get height() { return this._height; }
    set height(value) { this._height = value; this.pixels = new Uint8ClampedArray(this._width * this._height * 4); }
    getContext(type) {
      if (type !== '2d') return null;
      const context = {
        fillStyle: '#000000',
        translate() {}, scale() {},
        fillRect: () => {
          const white = context.fillStyle === '#ffffff';
          for (let index = 0; index < this.pixels.length; index += 4) { const value = white ? 255 : 0; this.pixels[index] = value; this.pixels[index + 1] = value; this.pixels[index + 2] = value; this.pixels[index + 3] = 255; }
        },
        getImageData: () => new ImageData(new Uint8ClampedArray(this.pixels), this.width, this.height),
        putImageData: image => { this.pixels = new Uint8ClampedArray(image.data); },
        drawImage: image => {
          const source = image?.data ?? image?.pixels;
          if (!source || !image.width || !image.height) throw new Error('Node canvas can only draw decoded embedded images.');
          for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
            const sx = Math.min(image.width - 1, Math.floor(x * image.width / this.width));
            const sy = Math.min(image.height - 1, Math.floor(y * image.height / this.height));
            const from = (sy * image.width + sx) * 4; const to = (y * this.width + x) * 4;
            this.pixels[to] = source[from]; this.pixels[to + 1] = source[from + 1]; this.pixels[to + 2] = source[from + 2]; this.pixels[to + 3] = source[from + 3];
          }
        },
      };
      return context;
    }
    async convertToBlob() {
      if (!this.pixels) throw new Error('Node canvas received no image pixels.');
      const png = new PNG({ width: this.width, height: this.height });
      png.data = Buffer.from(this.pixels);
      return new Blob([PNG.sync.write(png)], { type: 'image/png' });
    }
  };
  if (!globalThis.FileReader) globalThis.FileReader = class FileReader {
    result = null; onloadend = null; onerror = null;
    readAsArrayBuffer(blob) { blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();},error=>this.onerror?.(error)); }
    readAsDataURL(blob) { blob.arrayBuffer().then(value=>{this.result=`data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(value).toString('base64')}`;this.onloadend?.();},error=>this.onerror?.(error)); }
  };
}
