const fs=require('node:fs'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const web='/Users/tim/Code/fhfhockey.com/web',req=createRequire(web+'/package.json'),ts=req('typescript'),React=req('react'),{renderToStaticMarkup}=req('react-dom/server'),{JSDOM}=req('jsdom'),sharp=req('sharp');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,f);
const Card=req('./components/player-cards/PlayerAnalysisCard.tsx').default,{sharedGoalieFixture,goalieFixture}=req('./lib/player-cards/analysisFixtures.ts'),{sharedGoalieOutlook}=req('./lib/player-cards/sharedGoalieOutlook.ts'),{assertAnalysisExport,analysisManifest,rasterizeAnalysis}=req('./lib/player-cards/analysisExport.ts');
const cases=[['normal',["Reports aren't separated by reporter, so conflicts between sources can't be detected.","No source link or expiry exists for these reports."],true],['long-token',['https://example.test/'+'w'.repeat(300)],false],['wide-token',['W'.repeat(120)],false],['wrapped-wide',['W'.repeat(60)+' '+'W'.repeat(60)],true]];
(async()=>{const results=[];for(const [name,warnings,accepted] of cases){
 const input=sharedGoalieFixture();input.sources[0].reasons=warnings;const p={goalie:sharedGoalieOutlook(input,goalieFixture().player,'fixture'),gameIndex:0};const markup=renderToStaticMarkup(React.createElement(Card,{presentation:p}));const dom=new JSDOM(markup),svg=dom.window.document.querySelector('svg');
 assert.throws(()=>assertAnalysisExport(svg,p));
 const evidence=[...svg.querySelectorAll('[data-evidence-max-width]')];const measurements=[];
 for(const text of evidence){
  // Independently derive ink bounds with a local SVG renderer. This is deliberately not claimed as browser getBBox.
  const isolated='<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="1020"><g font-family="Arial, sans-serif">'+text.outerHTML+'</g></svg>';
  const {info}=await sharp(Buffer.from(isolated)).trim({background:'#00000000'}).png().toBuffer({resolveWithObject:true});
  Object.defineProperty(text,'getBBox',{configurable:true,value:()=>({width:info.width})});measurements.push({warning:text.hasAttribute('data-confirmation-warnings'),width:info.width});
 }
 const warning=svg.querySelector('[data-confirmation-warnings="true"]'),spans=[...warning.querySelectorAll('tspan')].map(t=>t.textContent);assert(spans.every(Boolean));
 assert(warnings.every(w=>svg.getAttribute('aria-label').includes(w)));assert.deepEqual(analysisManifest(p).presentation.goalie.sharedProvenance.confirmationWarnings,warnings);
 if(accepted)assert.doesNotThrow(()=>assertAnalysisExport(svg,p));else {assert.throws(()=>assertAnalysisExport(svg,p),/Full evidence/);await assert.rejects(rasterizeAnalysis(svg,p),/Full evidence/)}
 if(name==='long-token'){assert.equal(warning.getAttribute('data-evidence-truncated'),'true');assert(warning.textContent.includes('PNG export is unavailable'))}
 if(name==='wide-token'){assert.equal(warning.getAttribute('data-evidence-truncated'),null);assert(measurements.find(m=>m.warning).width>1120)}
 let invalidGeometry=[];
 if(name==='normal'){
  for(const width of [1121,Infinity,NaN,0,-1]){Object.defineProperty(warning,'getBBox',{configurable:true,value:()=>({width})});await assert.rejects(rasterizeAnalysis(svg,p),/Full evidence/);invalidGeometry.push(String(width))}
  Object.defineProperty(warning,'getBBox',{configurable:true,value:undefined});await assert.rejects(rasterizeAnalysis(svg,p),/bounds are unavailable/);invalidGeometry.push('missing getBBox');
 }
 await sharp(Buffer.from(markup)).png().toFile(__dirname+'/'+name+'.png');
 fs.writeFileSync(__dirname+'/'+name+'.svg',markup);results.push({name,accepted,measurements,truncated:warning.getAttribute('data-evidence-truncated')==='true',spans,fullWarningPreservedInAriaAndManifest:true,invalidGeometryRejected:invalidGeometry});dom.window.close();
 }
 fs.writeFileSync(__dirname+'/REPRODUCTION.json',JSON.stringify({results,measurementMethod:'sharp/libvips ink bounds supplied to DOM guard; native Chromium results separately inspected from pinned owner receipt',browserRerun:false},null,2)+'\n');console.log(JSON.stringify(results.map(({spans,...r})=>({...r,lineLengths:spans.map(t=>t.length)}))));
})().catch(e=>{console.error(e);process.exitCode=1});
