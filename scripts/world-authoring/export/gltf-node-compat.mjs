export function installGltfNodeCompat() {
  if (!globalThis.FileReader) globalThis.FileReader = class FileReader {
    result = null; onloadend = null; onerror = null;
    readAsArrayBuffer(blob) { blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();},error=>this.onerror?.(error)); }
    readAsDataURL(blob) { blob.arrayBuffer().then(value=>{this.result=`data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(value).toString('base64')}`;this.onloadend?.();},error=>this.onerror?.(error)); }
  };
}
