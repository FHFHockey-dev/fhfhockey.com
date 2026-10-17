// Type-check virtual application paths without applying the candidate patch.
const fs = require('node:fs');
const path = require('node:path');
const BASE = __dirname;
const ROOT = path.resolve(BASE, '../../..');
const WEB = path.join(ROOT, 'web');
const ts = require(path.join(WEB, 'node_modules/typescript'));
const configPath = path.join(WEB, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, WEB);
const options = { ...parsed.options, noEmit: true, incremental: false };
const host = ts.createCompilerHost(options);
const originalRead = host.readFile.bind(host), originalExists = host.fileExists.bind(host);
const candidatePath = file => {
  const relative = path.relative(ROOT, file);
  if (relative.startsWith('..')) return null;
  const proposed = path.join(BASE, 'candidate', relative);
  return fs.existsSync(proposed) ? proposed : null;
};
host.readFile = file => originalRead(candidatePath(file) ?? file);
host.fileExists = file => Boolean(candidatePath(file)) || originalExists(file);
const getSource = host.getSourceFile.bind(host);
host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => {
  const candidate = candidatePath(file);
  return candidate ? ts.createSourceFile(file, fs.readFileSync(candidate, 'utf8'), languageVersion, true)
    : getSource(file, languageVersion, onError, shouldCreateNewSourceFile);
};
const bindings = JSON.parse(fs.readFileSync(path.join(BASE, 'source-bindings.json')));
const roots = Object.keys(bindings.candidateSha256).map(file => path.join(ROOT, file));
const program = ts.createProgram(roots, options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  process.stdout.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => WEB, getNewLine: () => '\n',
  }));
  process.exitCode = 1;
} else {
  process.stdout.write(`Candidate type-check passed: ${roots.length} virtual roots; no emit.\n`);
}
