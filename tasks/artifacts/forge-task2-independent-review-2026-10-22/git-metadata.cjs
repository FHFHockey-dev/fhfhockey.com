#!/usr/local/bin/node
// Test-only metadata for the non-Git pinned snapshot; no Git operation is dispatched.
const args = process.argv.slice(2);
if (JSON.stringify(args) === JSON.stringify(['rev-parse', 'HEAD'])) console.log('84cb1229cd1c1cdd037c43e660d2a181304ada51');
else if (JSON.stringify(args) === JSON.stringify(['branch', '--show-current'])) console.log('octoberBranch');
else { console.error('Only the two pinned snapshot metadata queries are supported'); process.exitCode = 1; }
