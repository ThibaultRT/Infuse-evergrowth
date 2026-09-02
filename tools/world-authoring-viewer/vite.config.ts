import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const viewerRoot=import.meta.dirname;
const generatedRoot=path.resolve(viewerRoot,'../../authoring/generated');
const generatedFiles=new Map([
  ['/generated/manifests/world-visual-manifest.json',['manifests/world-visual-manifest.json','application/json']],
  ['/generated/reports/build-report.json',['reports/build-report.json','application/json']],
  ['/generated/preview/assembled-world.glb',['preview/assembled-world.glb','model/gltf-binary']],
]);

export default defineConfig({
  root:viewerRoot,
  server:{fs:{allow:[path.resolve(viewerRoot,'../..')]}},
  plugins:[{
    name:'serve-generated-world',
    configureServer(server){
      server.middlewares.use(async(request,response,next)=>{
        const pathname=new URL(request.url??'','http://authoring.local').pathname;
        const entry=generatedFiles.get(pathname);
        if(!entry){next();return;}
        try{
          const [relativePath,contentType]=entry;
          response.statusCode=200;response.setHeader('Content-Type',contentType);response.setHeader('Cache-Control','no-store');response.end(await readFile(path.join(generatedRoot,relativePath)));
        }catch(error){
          if((error as NodeJS.ErrnoException).code==='ENOENT'){response.statusCode=404;response.end('Run npm run authoring:build first.');return;}
          next(error as Error);
        }
      });
    },
  }],
  base:'/',
});
