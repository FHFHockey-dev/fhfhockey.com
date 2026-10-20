// Conservative offline function/callback closure. Results are candidates for source review, not runtime proof.
const fs=require('fs'),path=require('path'),ts=require('../../../web/node_modules/typescript');
const inv=JSON.parse(fs.readFileSync(path.join(__dirname,'source-inventory.json'),'utf8'));const root=process.cwd(), mods=new Map();
for(const m of inv.modules){const file=path.join(root,m.path),source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);const rec={...m,source,bindings:new Map(),exports:new Map(),importMap:new Map(),initializers:[]};mods.set(m.path,rec);
for(const i of m.imports)for(const n of i.names)rec.importMap.set(n,i);
for(const n of source.statements){if(ts.isFunctionDeclaration(n)&&n.name)rec.bindings.set(n.name.text,n);if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(ts.isIdentifier(d.name)&&d.initializer){rec.bindings.set(d.name.text,d.initializer);rec.initializers.push(d.initializer);}
if(n.modifiers?.some(k=>k.kind===ts.SyntaxKind.ExportKeyword)){if(n.modifiers.some(k=>k.kind===ts.SyntaxKind.DefaultKeyword))rec.exports.set('default',n);else if(n.name)rec.exports.set(n.name.text,n);else if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(ts.isIdentifier(d.name)&&d.initializer)rec.exports.set(d.name.text,d.initializer);}
if(ts.isExportAssignment(n))rec.exports.set('default',n.expression);
if(ts.isImportDeclaration(n)&&n.importClause){const i=m.imports.find(x=>x.line===source.getLineAndCharacterOfPosition(n.getStart()).line+1);if(!i)continue;if(n.importClause.name)rec.importMap.set(n.importClause.name.text,{...i,exportName:'default'});if(n.importClause.namedBindings&&ts.isNamedImports(n.importClause.namedBindings))for(const el of n.importClause.namedBindings.elements)rec.importMap.set(el.name.text,{...i,exportName:(el.propertyName||el.name).text});}
if(ts.isExportDeclaration(n)&&n.exportClause&&ts.isNamedExports(n.exportClause)){for(const el of n.exportClause.elements)rec.exports.set(el.name.text,{reexport:true,exportName:(el.propertyName||el.name).text,target:m.imports.find(i=>i.line===source.getLineAndCharacterOfPosition(n.getStart()).line+1)?.target});}
}}
function expr(n){if(ts.isIdentifier(n))return n.text;if(ts.isPropertyAccessExpression(n))return expr(n.expression)+'.'+n.name.text;if(ts.isElementAccessExpression(n))return expr(n.expression)+'[]';if(ts.isCallExpression(n))return expr(n.expression)+'()';if(ts.isParenthesizedExpression(n)||ts.isAwaitExpression(n)||ts.isAsExpression(n)||ts.isNonNullExpression(n))return expr(n.expression);return '<expression>';}
const outputs=[];
for(const r of inv.routes){const seen=new Set(),calls=[],functions=[];function exported(p,name){const m=mods.get(p);if(!m)return;const n=m.exports.get(name);if(!n)return;if(n.reexport)return exported(n.target,n.exportName);reach(p,n);}
function resolveId(p,name){const m=mods.get(p),n=m.bindings.get(name);if(n)return reach(p,n);const i=m.importMap.get(name);if(i?.target)exported(i.target,i.exportName||'default');}
function reach(p,n){if(!n)return;const key=p+':'+n.pos+':'+n.end;if(seen.has(key))return;seen.add(key);const m=mods.get(p);functions.push({path:p,line:m.source.getLineAndCharacterOfPosition(n.getStart()).line+1,name:n.name?.text||expr(n)});
if(ts.isIdentifier(n)){resolveId(p,n.text);return;}
function visit(q,isRoot=false){if(ts.isTypeNode(q))return;if(!isRoot&&ts.isFunctionDeclaration(q))return;if(ts.isIdentifier(q)&&!(ts.isPropertyAccessExpression(q.parent)&&q.parent.name===q)&&!(q.parent.name===q && (ts.isParameter(q.parent)||ts.isVariableDeclaration(q.parent)||ts.isBindingElement(q.parent))))resolveId(p,q.text);if(ts.isCallExpression(q)||ts.isNewExpression(q)){const e=expr(q.expression);const line=m.source.getLineAndCharacterOfPosition(q.getStart()).line+1;let arg=undefined;if(/\.(from|rpc)$/.test(e)&&q.arguments?.[0]&&ts.isStringLiteral(q.arguments[0]))arg=q.arguments[0].text;calls.push({path:p,line,expr:e,...arg?{arg}:{}});if(ts.isIdentifier(q.expression))resolveId(p,q.expression.text);for(const a of q.arguments||[])if(ts.isIdentifier(a))resolveId(p,a.text);}
ts.forEachChild(q,c=>visit(c));}
visit(n,true);}
exported(r.path,'default');for(const n of mods.get(r.path).initializers)if(!ts.isArrowFunction(n)&&!ts.isFunctionExpression(n))reach(r.path,n);
outputs.push({path:r.path,functions,calls});}
fs.writeFileSync(path.join(__dirname,'reachable-calls.json'),JSON.stringify(outputs,null,2)+'\n');
const effect=c=>/\.(insert|upsert|update|delete|rpc|upload|remove|sendMail|sendMessage|post|put|patch|request|writeFile|appendFile|create|mutate|commit)$|(^|\.)fetch$|^Fetch$|axios\.(get|post)|\.emails\.send|\.spreadsheets\./i.test(c.expr);
fs.writeFileSync(path.join(__dirname,'reachable-effects.txt'),outputs.map(r=>r.path.replace('web/pages/api/','')+'\n'+r.calls.filter(effect).map(c=>'  '+c.path+':'+c.line+' '+c.expr+(c.arg?' '+c.arg:'')).join('\n')).join('\n')+'\n');console.log(outputs.length);
