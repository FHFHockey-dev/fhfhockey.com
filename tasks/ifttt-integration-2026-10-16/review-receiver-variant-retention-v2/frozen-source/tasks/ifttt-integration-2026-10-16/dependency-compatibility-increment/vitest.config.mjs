import base from '../consumer-binding-increment/vitest.config.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../..'),snapshot=resolve(here,'dependency-snapshot');
const manifest=JSON.parse(readFileSync(resolve(here,'read-only-dependencies.json'),'utf8'));
const replacements=new Map(manifest.files.filter(r=>r.path.endsWith('.ts')).map(r=>[resolve(repo,r.path),resolve(repo,r.snapshotPath)]));
const used=new Set();
process.once('exit',()=>writeFileSync(resolve(here,'correction-v2/loaded-dependencies.json'),JSON.stringify([...used].sort(),null,2)+'\n'));
const captured={name:'ifttt-exact-read-only-dependencies',enforce:'pre',async resolveId(source,importer){
 if(!importer||source.startsWith('\0'))return null;
 const originalImporter=importer.startsWith(snapshot+'/')?resolve(repo,importer.slice(snapshot.length+1)):importer;
 const candidate=source.startsWith('.')?resolve(dirname(originalImporter),source):source.startsWith('lib/')?resolve(repo,'web',source):source;
 const found=replacements.get(candidate)||replacements.get(candidate+'.ts');
 if(found){used.add(found.slice(repo.length+1));return found;}
 if(originalImporter!==importer)return this.resolve(source,originalImporter,{skipSelf:true});
 return null;
}};
export default {...base,plugins:[captured,...(base.plugins??[])],test:{...base.test,include:[fileURLToPath(new URL('./*.test.ts',import.meta.url))]}};
