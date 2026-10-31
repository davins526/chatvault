import {copyFileSync,mkdirSync} from 'node:fs';
mkdirSync('dist',{recursive:true});
for(const name of ['manifest.json','popup.html','offscreen.html'])copyFileSync(`public/${name}`,`dist/${name}`);
mkdirSync('dist/icons',{recursive:true});
for(const name of ['icon16.png','icon48.png','icon128.png'])copyFileSync(`public/icons/${name}`,`dist/icons/${name}`);
