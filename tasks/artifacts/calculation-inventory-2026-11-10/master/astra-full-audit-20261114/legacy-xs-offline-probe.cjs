const fs=require('fs'),ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript'),vm=require('vm'),assert=require('assert/strict');
const p='/Users/tim/Code/fhfhockey.com/web/pages/api/Teams/[teamAbbreviation].ts';const src=fs.readFileSync(p,'utf8'),sf=ts.createSourceFile(p,src,ts.ScriptTarget.Latest,true);
const selected=[];
for(const s of sf.statements){if(ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>['knownCount','columnTotal'].includes(d.name.getText(sf))))selected.push(s.getText(sf));if(ts.isFunctionDeclaration(s)&&s.name.text==='pooledRatio')selected.push(s.getText(sf).replace('export ',''));}
assert.equal(selected.length,3);let expr;function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='xSPct')expr=n.initializer.getText(sf);ts.forEachChild(n,walk)}walk(sf);assert(expr);
const code=ts.transpileModule(selected.join('\n')+'\nresult = '+expr+';', {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const context={individual:{headers:['ixG','Shots','iFF'],data:[['12','120','200']]},result:undefined};vm.runInNewContext(code,context,{timeout:1000});assert.equal(context.result,.1);assert.equal(12/200,.06);console.log(JSON.stringify({actual:context.result,decision17Expected:12/200,sourceExpression:expr,networkCalls:0}));
