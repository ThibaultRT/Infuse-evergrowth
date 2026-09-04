import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const viewerRoot=import.meta.dirname;
const developmentAssetsRoot=path.resolve(viewerRoot,'../../authoring/local/world-development/source-assets/another-example-public-assets');

export default defineConfig({
  root:viewerRoot,
  publicDir:path.resolve(viewerRoot,'../../public'),
  server:{fs:{allow:[path.resolve(viewerRoot,'../..')]}},
  plugins:[{
    name:'serve-local-world-development-assets',
    configureServer(server){
      server.middlewares.use(async(request,response,next)=>{
        const pathname=new URL(request.url??'','http://authoring.local').pathname;
        if(pathname.startsWith('/@world-development/')){
          const relative=decodeURIComponent(pathname.slice('/@world-development/'.length));
          const target=path.resolve(developmentAssetsRoot,relative);
          if(!target.startsWith(`${developmentAssetsRoot}${path.sep}`)){response.statusCode=403;response.end('Forbidden');return;}
          try{
            const extension=path.extname(target).toLowerCase();
            const contentType=extension==='.gltf'?'model/gltf+json':extension==='.glb'?'model/gltf-binary':extension==='.png'?'image/png':extension==='.jpg'||extension==='.jpeg'?'image/jpeg':'application/octet-stream';
            response.statusCode=200;response.setHeader('Content-Type',contentType);response.setHeader('Cache-Control','no-store');response.end(await readFile(target));return;
          }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT'){response.statusCode=404;response.end('Missing development asset');return;}next(error as Error);return;}
        }
        next();
      });
    },
  }],
  base:'/',
});
