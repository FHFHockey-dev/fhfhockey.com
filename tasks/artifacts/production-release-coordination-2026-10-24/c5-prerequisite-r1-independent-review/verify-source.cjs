// Static source comparison only: never imports or invokes application modules.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..');
const ts = require(path.join(repo, 'web/node_modules/typescript'));
const packet = path.join(repo, 'tasks/artifacts/production-release-coordination-2026-10-24/c5-prerequisite-r1');
const manifest = JSON.parse(fs.readFileSync(path.join(packet, 'CANDIDATE.json'), 'utf8'));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const source = file => fs.readFileSync(path.join(manifest.snapshot, file), 'utf8');
const prod = file => cp.execFileSync('git', ['show', manifest.base + ':' + file], { cwd: repo, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const namedCall = (ast, node, name) => ts.isCallExpression(node) && node.expression.getText(ast) === name;
function bodyHashes(ast) { const result=[]; const visit=node=>{ if(ts.isFunctionLike(node)&&node.body)result.push(hash(node.body.getText(ast)));ts.forEachChild(node,visit); };visit(ast);return result; }
const imports = ast => ast.statements.filter(ts.isImportDeclaration).map(node => node.getText(ast));
const exportCall = ast => ast.statements.find(ts.isExportAssignment)?.expression;
function routeList(ast) { const declaration=ast.statements.filter(ts.isVariableStatement).flatMap(s=>[...s.declarationList.declarations]).find(d=>d.name.getText(ast)==='authFirstAuditRoutes');let value=declaration?.initializer;if(ts.isAsExpression(value))value=value.expression;if(!ts.isArrayLiteralExpression(value))throw Error('Missing route list');return value.elements.map(e=>e.text); }
function restore(candidate, replacements) { for(const edit of replacements.sort((a,b)=>b.start-a.start))candidate=candidate.slice(0,edit.start)+edit.text+candidate.slice(edit.end);return candidate; }
const testPath='web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts';
const routes=routeList(parse(testPath,source(testPath)));
const rows=[];
for(const relative of routes){
  const file='web/pages/api/'+relative;const before=prod(file);const after=source(file);const a=parse(file,before),b=parse(file,after);const outerA=exportCall(a),outerB=exportCall(b);
  if(file.endsWith('/update-drafted-prospects.ts')){rows.push({path:file,already_auth_first_r2:true,candidate_sha256:hash(after)});continue;}
  if(!namedCall(a,outerA,'withCronJobAudit')||!namedCall(b,outerB,'adminOnly')||outerB.arguments.length!==1||!namedCall(b,outerB.arguments[0],'withCronJobAudit'))throw Error(file+': wrapper contract');
  const auditB=outerB.arguments[0];let callbackA=outerA.arguments[0];const replacements=[{start:outerB.getStart(b),end:outerB.end,text:outerA.getText(a)}];
  if(file==='web/pages/api/Teams/nst-team-stats.ts'){
    const declaration=ast=>ast.statements.filter(ts.isVariableStatement).flatMap(s=>[...s.declarationList.declarations]).find(d=>d.name.getText(ast)===callbackA.getText(a));
    const da=declaration(a),db=declaration(b);
    if(!namedCall(a,da?.initializer,'adminOnly')||da.initializer.arguments.length!==1)throw Error('NST inner auth shape');
    if(da.initializer.arguments[0].getText(a)!==db.initializer.getText(b))throw Error('NST complete work handler changed');
    replacements.push({start:db.initializer.getStart(b),end:db.initializer.end,text:da.initializer.getText(a)});
    if(callbackA.getText(a)!==auditB.arguments[0].getText(b))throw Error('NST handler reference changed');
  } else {
    if(!namedCall(a,callbackA,'adminOnly')||callbackA.arguments.length!==1)throw Error(file+': production admission shape');
    if(callbackA.arguments[0].getText(a)!==auditB.arguments[0].getText(b))throw Error(file+': audit callback expression changed');
  }
  if(JSON.stringify([...outerA.arguments].slice(1).map(n=>n.getText(a)))!==JSON.stringify([...auditB.arguments].slice(1).map(n=>n.getText(b))))throw Error(file+': audit options changed');
  if(outerA.typeArguments?.length||auditB.typeArguments?.length||outerB.typeArguments?.length)throw Error(file+': unexpected type args');
  const sameBodies=JSON.stringify(bodyHashes(a))===JSON.stringify(bodyHashes(b));const sameImports=JSON.stringify(imports(a))===JSON.stringify(imports(b));const restoredExact=restore(after,replacements)===before;
  if(!sameBodies||!sameImports||!restoredExact)throw Error(file+': non-wrapper change');
  rows.push({path:file,production_sha256:hash(before),candidate_sha256:hash(after),function_body_sha256:bodyHashes(a),imports_unchanged:sameImports,callback_expression_and_audit_options_unchanged:true,exact_production_restored_by_reverting_wrapper_expressions:restoredExact});
}
const selected={};for(const [file,pin]of Object.entries(manifest.selected)){const actual=hash(fs.readFileSync(path.join(manifest.snapshot,file)));if(actual!==pin.sha256)throw Error(file+': candidate drift');selected[file]={sha256:actual,source:pin.source};}
const middleware='web/utils/adminOnlyMiddleware.ts';const mwSame=source(middleware)===prod(middleware);if(!mwSame)throw Error('Admission middleware drift');
const nst=source('web/pages/api/Teams/nst-team-stats.ts');if(/NST_TEAM_TABLE_SECRET|x-nst-team/.test(nst))throw Error('NST new caller-secret behavior imported');
const result={manifest_sha256:hash(fs.readFileSync(path.join(packet,'CANDIDATE.json'))),base:manifest.base,snapshot:manifest.snapshot,selected_count:Object.keys(selected).length,route_count:routes.length,transformed:rows.filter(x=>!x.already_auth_first_r2).length,already_auth_first:rows.filter(x=>x.already_auth_first_r2).length,selected,route_comparisons:rows,admin_middleware_matches_production:mwSame,admin_middleware_sha256:hash(source(middleware)),nst_new_secret_absent:true,source_only_no_application_execution:true};
fs.writeFileSync(path.join(__dirname,'SOURCE-COMPARISON.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({selected:result.selected_count,routes:result.route_count,transformed:result.transformed,already_auth_first:result.already_auth_first,middleware_unchanged:mwSame,all_callbacks_options_imports_and_other_source_preserved:true}));
