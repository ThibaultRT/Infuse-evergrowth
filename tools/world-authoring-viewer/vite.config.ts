import { defineConfig } from 'vite';
import path from 'node:path';
const viewerRoot=import.meta.dirname;
export default defineConfig({root:viewerRoot,server:{fs:{allow:[path.resolve(viewerRoot,'../..')] }},resolve:{alias:{'/generated':path.resolve(viewerRoot,'../../authoring/generated')}},base:'/'});
