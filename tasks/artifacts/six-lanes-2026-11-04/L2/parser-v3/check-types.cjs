const ts = require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const path = require('node:path');
const web = '/Users/tim/Code/fhfhockey.com/web';
const config = ts.readConfigFile(path.join(web, 'tsconfig.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, web);
const host = ts.createCompilerHost(parsed.options);
host.resolveModuleNames = (names, containing) => names.map(name => {
  const candidate = path.dirname(containing) === __dirname;
  if (candidate && name === './researchSnapshot') return { resolvedFileName: path.join(__dirname, 'researchSnapshot.ts'), extension: ts.Extension.Ts };
  return ts.resolveModuleName(name, candidate ? path.join(web, 'lib/buyLowSellHigh', path.basename(containing)) : containing, parsed.options, ts.sys).resolvedModule;
});
const program = ts.createProgram(['researchSnapshot.ts', 'researchSnapshot.test.ts'].map(p => path.join(__dirname, p)), parsed.options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => web, getNewLine: () => '\n' }));
console.log(`${diagnostics.length} diagnostics in isolated parser/test dependency graph`);
process.exitCode = diagnostics.length ? 1 : 0;
