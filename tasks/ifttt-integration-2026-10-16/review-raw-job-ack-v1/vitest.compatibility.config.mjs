import base from './vitest.review.config.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../..'),snapshot=resolve(here,'dependency-snapshot');
const manifest=JSON.parse(readFileSync(resolve(here,'read-only-dependencies.json'),'utf8'));
const replacements=new Map(manifest.files.filter(r=>r.path.endsWith('.ts')).map(r=>[resolve(repo,r.path),resolve(snapshot,r.path)]));
const expected=new Map(manifest.files.map(r=>[resolve(snapshot,r.path),r.sha256]));
const resolved=new Set(),loaded=new Map();
mkdirSync(resolve(here,'execution-traces'),{recursive:true});
process.once('exit',()=>writeFileSync(resolve(here,'resolved-loaded-dependencies.json'),JSON.stringify({resolved:[...resolved].sort(),loaded:[...loaded].sort()},null,2)+'\n'));
const captured={name:'ifttt-independent-captured-execution',enforce:'pre',async resolveId(source,importer){
 if(!importer||source.startsWith('\0'))return null;
 const originalImporter=importer.startsWith(snapshot+'/')?resolve(repo,importer.slice(snapshot.length+1)):importer;
 const candidate=source.startsWith('.')?resolve(dirname(originalImporter),source):source.startsWith('lib/')?resolve(repo,'web',source):source;
 const found=replacements.get(candidate)||replacements.get(candidate+'.ts');
 if(found){resolved.add(relative(snapshot,found));return found;}
 if(originalImporter!==importer)return this.resolve(source,originalImporter,{skipSelf:true});
 return null;
},load(id){
 const p=id.split('?')[0];if(!expected.has(p))return null;
 const sha=createHash('sha256').update(readFileSync(p)).digest('hex');if(sha!==expected.get(p))throw new Error('Captured dependency changed: '+p);
 loaded.set(relative(snapshot,p),sha);return null;
},transform(code,id){
 const p=id.split('?')[0];if(!expected.has(p))return null;
 // Observational marker only; captured file bytes and all original test bodies remain unchanged.
 const marker=JSON.stringify({path:relative(snapshot,p),sha256:expected.get(p)});
 return {code:`;(globalThis[Symbol.for('ifttt.review.captured.execution')] ||= []).push(${marker});\n${code}`,map:null};
}};
export default {...base,plugins:[captured,...(base.plugins??[])],test:{...base.test,setupFiles:[...base.test.setupFiles,resolve(here,'capture-trace.setup.ts')]}};
