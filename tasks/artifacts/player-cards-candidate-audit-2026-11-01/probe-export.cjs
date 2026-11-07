const fs=require('node:fs'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const web='/Users/tim/Code/fhfhockey.com/web', req=createRequire(web+'/package.json');
const ts=req('typescript'),React=req('react'),{renderToStaticMarkup}=req('react-dom/server'),{JSDOM}=req('jsdom');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,f);
const Card=req('./components/player-cards/PlayerAnalysisCard.tsx').default;
const {sharedGoalieFixture,goalieFixture}=req('./lib/player-cards/analysisFixtures.ts');
const {sharedGoalieOutlook}=req('./lib/player-cards/sharedGoalieOutlook.ts');
const {assertAnalysisExport,analysisManifest}=req('./lib/player-cards/analysisExport.ts');
const cases=[['normal',["Reports aren't separated by reporter, so conflicts between sources can't be detected.","No source link or expiry exists for these reports."]],['long-token',['https://example.test/'+'w'.repeat(300)]]];
const results=[];
for(const [name,warnings] of cases){
 const input=sharedGoalieFixture();input.sources[0].reasons=warnings;
 const p={goalie:sharedGoalieOutlook(input,goalieFixture().player,'fixture'),gameIndex:0};
 const svg=renderToStaticMarkup(React.createElement(Card,{presentation:p}));const dom=new JSDOM(svg),element=dom.window.document.querySelector('svg');
 let accepted=true,error=null;try{assertAnalysisExport(element,p)}catch(e){accepted=false;error=e.message}
 const spans=[...element.querySelector('[data-confirmation-warnings="true"]').querySelectorAll('tspan')].map(e=>e.textContent);
 const result={name,warnings,exportAccepted:accepted,error,markedTruncated:!!element.querySelector('[data-evidence-truncated="true"]'),lineLengths:spans.map(s=>s.length),ariaPreservesFullWarning:warnings.every(w=>element.getAttribute('aria-label').includes(w)),manifestPreservesFullWarning:JSON.stringify(analysisManifest(p).presentation.goalie.sharedProvenance.confirmationWarnings)===JSON.stringify(warnings)};
 fs.writeFileSync(__dirname+'/'+name+'.html','<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">'+svg+'</body></html>');
 fs.writeFileSync(__dirname+'/'+name+'.svg',svg);results.push(result);dom.window.close();
}
assert(results.every(r=>r.exportAccepted));assert.deepEqual(results[1].lineLengths,[0,321]);
fs.writeFileSync(__dirname+'/export-probe.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
