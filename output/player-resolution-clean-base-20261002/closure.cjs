const ts=require('/tmp/fhfh-player-resolution-fixes/web/node_modules/typescript');
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const root=process.env.CLOSURE_ROOT||'/tmp/fhfh-player-resolution-fixes/web',repo='/Users/tim/Code/fhfhockey.com';
const out=repo+'/output/player-resolution-clean-base-20261002';
const audit=JSON.parse(fs.readFileSync(repo+'/output/player-resolution-audit-20261002/source-manifest.json')).sha256;
const original=JSON.parse(fs.readFileSync(out+'/original-overlay-inventory.json'));
const cfg=ts.parseJsonConfigFileContent(ts.readConfigFile(root+'/tsconfig.json',ts.sys.readFile).config,ts.sys,root).options;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const edges=[],seen=new Set(),queue=process.env.CLOSURE_API?['pages/api/v1/db/player-name-aliases.ts']:['pages/db/player-aliases.tsx','pages/_app.tsx'],typeOnly=[],external=new Set();
function resolve(spec,from){
 if(spec.startsWith('http')||spec.startsWith('sass:'))return null;
 const extensions=['','.ts','.tsx','.js','.jsx','.scss','.css','.json'];
 const stem=spec.startsWith('.')?path.resolve(path.dirname(from),spec):path.resolve(root,spec);
 const candidates=[];
 for(const ext of extensions)candidates.push(stem+ext,path.join(stem,'index'+ext));
 const dir=path.dirname(stem),name=path.basename(stem);
 candidates.push(path.join(dir,'_'+name+'.scss'));
 for(const file of candidates)if(fs.existsSync(file)&&fs.statSync(file).isFile())return file;
 const r=ts.resolveModuleName(spec,from,cfg,ts.sys).resolvedModule;
 if(r&&!r.isExternalLibraryImport&&r.resolvedFileName.startsWith(root+'/'))return r.resolvedFileName;
 external.add(spec);return null;
}
function add(spec,from,kind){const file=resolve(spec,from);if(file){const rel=path.relative(root,file);edges.push({from:'web/'+path.relative(root,from),to:'web/'+rel,spec,kind});if(!seen.has(rel))queue.push(rel);}}
while(queue.length){
 const rel=queue.shift();if(seen.has(rel))continue;seen.add(rel);const file=path.join(root,rel),source=fs.readFileSync(file,'utf8');
 if(/\.(scss|css)$/.test(rel)){for(const m of source.matchAll(/@(?:use|forward|import)\s+["']([^"']+)["']/g))add(m[1],file,'style');continue;}
 if(!/\.[jt]sx?$/.test(rel))continue;
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
 function walk(node){
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
   const spec=node.moduleSpecifier.text;
   const onlyType=node.isTypeOnly||node.importClause?.isTypeOnly||(node.importClause?.namedBindings&&ts.isNamedImports(node.importClause.namedBindings)&&!node.importClause.name&&node.importClause.namedBindings.elements.every(e=>e.isTypeOnly));
   if(onlyType)typeOnly.push({from:'web/'+rel,spec});else add(spec,file,'runtime');
  }
  if(ts.isCallExpression(node)&&node.arguments.length&&ts.isStringLiteral(node.arguments[0])&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require')))add(node.arguments[0].text,file,'dynamic-runtime');
  ts.forEachChild(node,walk);
 }
 walk(ast);
}
const files=[...seen].sort().map(rel=>{const name='web/'+rel,data=fs.readFileSync(path.join(root,rel));let head=null;try{head=sha(cp.execFileSync('git',['show','73af9d051ecc755dd3695f5265bf5837bbfc7a4e:'+name],{cwd:repo,stdio:['ignore','pipe','ignore']}));}catch{}const actual=sha(data);return {path:name,headSha256:head,auditSha256:audit[name]||null,candidateSha256:actual,auditOverlay:original.some(i=>i.path===name),candidateChangesHead:actual!==head};});
const result={head:'73af9d051ecc755dd3695f5265bf5837bbfc7a4e',entrypoints:['web/pages/db/player-aliases.tsx','web/pages/_app.tsx'],files,edges,typeOnlyImports:typeOnly,externalPackages:[...external].sort(),originalOverlayRuntimeIntersection:files.filter(f=>f.auditOverlay),note:'Conservative static runtime/import and Sass closure from the resolver page and shared app shell; type-only imports are recorded separately and not runtime prerequisites. Exact entry module and local assets followed. Real API/save/auth execution remains mocked and is not certified by this graph.'};
fs.writeFileSync(out+'/'+(process.env.CLOSURE_OUTPUT||'runtime-closure.json'),JSON.stringify(result,null,2));
console.log('Closure files',files.length,'edges',edges.length);
console.log('Original dirty overlays in runtime closure',JSON.stringify(result.originalOverlayRuntimeIntersection.map(f=>({path:f.path,candidateChangesHead:f.candidateChangesHead})),null,2));
console.log('Type-only',JSON.stringify(typeOnly));
