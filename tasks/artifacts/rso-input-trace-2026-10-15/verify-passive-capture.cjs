const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<div>
  <fieldset id="rso-planning-setup"><label>Source<select><option value="yahoo" selected>Yahoo</option></select></label><label>Season<input value="20262027"></label><label>Time zone<input value="UTC"></label></fieldset>
  <div aria-label="Planning command bar"><button aria-controls="rso-planning-setup">Yahoo inputs <small>Retained · unverified</small></button></div>
  <div role="status">Yahoo default positions: 0/240 · provisional.<span>Stored position checks cover the first 240 players; 197 remain unchecked.</span><aside>Fixture name not needed in report</aside></div>
  <div role="status" hidden>Hidden old status</div>
  <details><summary>Shared schedule: partial</summary><ul><li>schedule: partial · Cache received 2026-10-14T00:12:54.911Z · stale</li><li>identities: partial · current roster unknown</li><li>unrelated: exclude</li></ul></details>
  <details><summary>Data health · 2 items</summary><ul><li>Availability coverage is partial.</li><li>Roster player private fixture has no unique identity.</li></ul></details>
  <details id="rso-rule-settings"><label>Acquisition timing<select><option value="unknown">Unknown</option></select></label><label>Acquisition cost<input value=""></label><label>Moves left<input value="2"></label></details>
</div>`, { url: 'http://fixture.invalid', runScripts: 'outside-only' });
let requests = 0, storageAccess = 0;
dom.window.fetch = () => { requests++; throw new Error('Network prohibited.'); };
for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(dom.window, key, { get() { storageAccess++; throw new Error('Storage prohibited.'); } });
const observer = new dom.window.MutationObserver(() => {}); observer.observe(dom.window.document, { subtree: true, attributes: true, childList: true, characterData: true });
const source = readFileSync(require('node:path').join(__dirname, 'passive-capture.js'), 'utf8');
const report = JSON.parse(dom.window.eval(source));
assert.equal(report.fields.Source.value, 'yahoo'); assert.equal(report.fields.Season.value, '20262027');
assert.equal(report.sourceState, 'Yahoo inputs Retained · unverified');
assert.equal(report.statuses.length, 1); assert.match(report.statuses[0], /197 remain unchecked/);
assert.ok(!JSON.stringify(report).includes('Fixture name')); assert.ok(!JSON.stringify(report).includes('private fixture'));
assert.equal(report.sharedEvidence.length, 2); assert.equal(report.providerLimitations.length, 1);
assert.deepEqual(report.transactionControls.map(row => row.value), ['unknown', '', '2']);
assert.equal(requests, 0); assert.equal(storageAccess, 0); assert.equal(observer.takeRecords().length, 0);
observer.disconnect(); dom.window.close();
console.log(JSON.stringify({ status: 'passed', syntheticDom: true, requests, storageAccess, mutations: 0, rawPlayerNamesExcluded: true }));
