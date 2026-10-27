import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const result=await build({entryPoints:['docs/app.js'],bundle:true,format:'iife',minify:true,target:['es2020'],write:false,legalComments:'inline'});
const css=await readFile('docs/style.css','utf8');const js=result.outputFiles[0].text.replaceAll('</script','<\\/script');
let html=await readFile('docs/index.html','utf8');html=html.replace('<link rel="icon" href="icon.svg" type="image/svg+xml">','').replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+css+'</style>').replace('<script type="module" src="app.js"></script>',()=>'<script>'+js+'</script>');
const license=await readFile('docs/vendor/THREE-LICENSE.txt','utf8');html=html.replace('<!doctype html>','<!doctype html>\n<!-- Three.js license\n'+license+'\n-->');
await writeFile('PLAY.html',html);console.log('PLAY.html built:',Buffer.byteLength(html),'bytes; no network dependencies.');
