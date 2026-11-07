const ts = require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const web = '/Users/tim/Code/fhfhockey.com/web';
const config = ts.readConfigFile(web + '/tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, web);
const roots = ['lib/buyLowSellHigh/researchSnapshot.test.ts', 'lib/buyLowSellHigh/displayProfile.test.ts', 'lib/buyLowSellHigh/supportGap.test.ts', 'lib/player-cards/retainedBlsh.test.ts'];
const program = ts.createProgram(roots.map(p => web + '/' + p), {...parsed.options, incremental: false});
const diagnostics = ts.getPreEmitDiagnostics(program);
console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, {getCanonicalFileName:f=>f,getCurrentDirectory:()=>web,getNewLine:()=>"\n"}));
console.log(diagnostics.length + ' diagnostics'); process.exitCode = diagnostics.length ? 1 : 0;
