// Focused check of the five actual application roots; no candidate overlay.
const fs = require('node:fs');
const path = require('node:path');
const BASE = __dirname, ROOT = path.resolve(BASE, '../../..'), WEB = path.join(ROOT,'web');
const ts = require(path.join(WEB,'node_modules/typescript'));
const config = ts.readConfigFile(path.join(WEB,'tsconfig.json'),ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
const parsed = ts.parseJsonConfigFileContent(config.config,ts.sys,WEB);
const options = { ...parsed.options,noEmit:true,incremental:false };
const bindings = JSON.parse(fs.readFileSync(path.join(BASE,'source-bindings.json')));
const roots = Object.keys(bindings.candidateSha256).map(file=>path.join(ROOT,file));
const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram(roots,options));
if (diagnostics.length) {
  process.stdout.write(ts.formatDiagnosticsWithColorAndContext(diagnostics,{
    getCanonicalFileName:file=>file,getCurrentDirectory:()=>WEB,getNewLine:()=> '\n',
  }));
  process.exitCode=1;
} else process.stdout.write(`Integrated type-check passed: ${roots.length} actual application roots; no overlay, emit or incremental write.\n`);
