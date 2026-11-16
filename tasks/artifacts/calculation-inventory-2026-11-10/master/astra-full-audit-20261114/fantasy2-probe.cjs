// Pure pinned-source variance-floor mutation probe, no application imports.
const cp=require('child_process'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const path='web/lib/fantasy-projections/evaluator.ts';const s=cp.execFileSync('git',['show','89da739cb:'+path],{encoding:'utf8'});const sf=ts.createSourceFile(path,s,ts.ScriptTarget.Latest,true);let expr;
function walk(n){if(ts.isBinaryExpression(n)&&n.left.getText(sf)==='variance'&&n.right.getText(sf)==='Math.max(rate, (residual / P10_Z) ** 2)')expr=n.right.getText(sf);ts.forEachChild(n,walk)}walk(sf);assert(expr);
const mutant=expr.replace('(residual / P10_Z)','residual');assert.notEqual(expr,mutant);
const context=vm.createContext({rate:4,residual:2,P10_Z:1.2815515655446004});const correct=vm.runInContext(expr,context),wrong=vm.runInContext(mutant,context);
assert.equal(correct,4);assert.equal(wrong,4);assert.equal(.8*correct+.8*.2*16,.8*wrong+.8*.2*16);
const discriminating=vm.createContext({rate:1,residual:4,P10_Z:1.2815515655446004});const a=vm.runInContext(expr,discriminating),b=vm.runInContext(mutant,discriminating);assert.notEqual(a,b);
console.log(JSON.stringify({target:'89da739cb',path,sha256:crypto.createHash('sha256').update(s).digest('hex'),expression:expr,mutant,existingFixture:{rate:4,residual:2,correctVariance:correct,wrongVariance:wrong,mixtureVariance:.8*correct+.8*.2*16},discriminatingFixture:{rate:1,residual:4,correctVariance:a,wrongVariance:b},checks:'all assertions passed; existing test cannot distinguish the missing z conversion'},null,2));
