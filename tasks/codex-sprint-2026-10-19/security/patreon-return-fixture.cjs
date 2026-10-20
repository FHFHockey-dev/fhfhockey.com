// Pure local normalization fixture. Extracts only two pure functions; never loads OAuth config or performs I/O beyond named source/receipt files.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ts=require('../../../web/node_modules/typescript');
const file='web/lib/integrations/patreon/oauth.ts',source=fs.readFileSync(file,'utf8');
const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
const names=new Set(['sanitizePatreonNextPath','buildPatreonAccountRedirect']);
const functions=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text));
assert.equal(functions.length,2);
const js=ts.transpileModule(functions.map(n=>n.getText(ast).replace(/^export /,'')).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
const context=vm.createContext({URLSearchParams,PATREON_CONNECT_DEFAULT_NEXT:'/account?section=patreon'});
vm.runInContext(js,context,{timeout:1000});
const input='/\t/attacker.example';
const sanitized=context.sanitizePatreonNextPath(input);
const redirect=context.buildPatreonAccountRedirect(input,'error','Synthetic fixture');
assert.equal(sanitized,input);
const target=new URL(redirect,'https://fhfh.invalid');
assert.equal(target.origin,'https://attacker.example');
// Node permits a horizontal tab in a Location value; no HTTP server is opened.
require('node:http').validateHeaderValue('Location',redirect);
const receipt={result:'PASS',scope:'pure sanitizer + WHATWG URL normalization + Node header-value acceptance; no network/navigation',source:file,sha256:crypto.createHash('sha256').update(source).digest('hex'),inputJson:JSON.stringify(input),sanitizerPreservedInput:true,normalizedOrigin:target.origin,locationHeaderAccepted:true};
fs.writeFileSync(__dirname+'/patreon-return-fixture.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
