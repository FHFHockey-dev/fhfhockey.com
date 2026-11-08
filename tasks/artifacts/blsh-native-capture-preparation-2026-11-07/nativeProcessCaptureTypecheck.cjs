// Local compiler-only check: substitute the isolated candidate for canonical
// client.ts in memory. Does not execute either source or write app files.
const fs = require('node:fs');
const path = require('node:path');
const web = path.resolve(__dirname, '../../../web');
const ts = require(path.join(web, 'node_modules/typescript'));
const canonical = path.join(web, 'lib/nst/client.ts');
const candidate = fs.readFileSync(path.join(__dirname, 'nativeProcessCaptureClient.candidate.ts'), 'utf8');
const config = ts.readConfigFile(path.join(web, 'tsconfig.json'), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, web);
parsed.options.paths = { ...parsed.options.paths, vitest: [path.join(web, "node_modules/vitest")] };
const host = ts.createCompilerHost(parsed.options);
const read = host.readFile.bind(host);
host.readFile = file => path.resolve(file) === canonical ? candidate : read(file);
const sources = ['scripts/blsh/nativeProcessCapturePreparation.ts', 'scripts/blsh/nativeProcessCapturePreparation.test.ts',
  '../tasks/artifacts/blsh-native-capture-preparation-2026-11-07/nativeProcessCaptureClient.test.ts', '../tasks/artifacts/blsh-native-capture-preparation-2026-11-07/nativeProcessCaptureCandidate.vitest.mts',
  '../tasks/artifacts/blsh-native-capture-preparation-2026-11-07/nativeProcessCaptureNetworkBlock.setup.ts', 'lib/nst/client.ts'];
const program = ts.createProgram(sources.map(file => path.join(web, file)), parsed.options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => web, getNewLine: () => '\n' }));
  process.exitCode = 1;
} else process.stdout.write('PASS: six focused roots, isolated client substitution, repository TypeScript options, no emit.\n');
