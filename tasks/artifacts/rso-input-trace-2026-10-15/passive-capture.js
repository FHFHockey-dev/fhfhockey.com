// Owner-run proposal only: reads current DOM controls/messages. No requests, storage, credentials, events or mutations.
(() => {
  const setup = document.getElementById('rso-planning-setup');
  if (!setup) return JSON.stringify({ status: 'optimizer_dom_not_present' });
  const root = setup.parentElement;
  const tidy = text => (text || '').replace(/\s+/g, ' ').trim();
  const direct = element => tidy([...element.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join(' '));
  const fields = {};
  for (const label of setup.querySelectorAll(':scope > label')) {
    const name = direct(label), control = label.querySelector('select,input');
    if (control && ['Source', 'Season', 'From', 'Through', 'My team', 'Team ID', 'League ID', 'Time zone'].includes(name)) {
      fields[name] = { value: control.value, ...(control.tagName === 'SELECT' ? { selectedText: tidy(control.selectedOptions[0]?.textContent) } : {}) };
    }
  }
  const command = root.querySelector('[aria-label="Planning command bar"] button[aria-controls="rso-planning-setup"]');
  const statuses = [...root.querySelectorAll('[role="status"],[role="alert"]')].filter(element => !element.closest('[hidden]'))
    .map(element => direct(element) + ' ' + [...element.children].filter(child => /^Stored position checks cover/.test(tidy(child.textContent))).map(child => tidy(child.textContent)).join(' '))
    .map(tidy).filter(Boolean).slice(0, 20).map(text => text.slice(0, 800));
  const details = [...root.querySelectorAll('details')];
  const shared = details.find(element => /^Shared schedule:/.test(tidy(element.querySelector('summary')?.textContent)));
  const provider = details.find(element => /^Data health/.test(tidy(element.querySelector('summary')?.textContent)));
  const transactionControls = [...root.querySelectorAll('#rso-rule-settings label')].filter(label =>
    ['Acquisition timing', 'Acquisition cost', 'Moves left'].includes(direct(label))).map(label => ({
      label: direct(label), value: label.querySelector('input,select')?.value ?? null }));
  return JSON.stringify({ status: 'passive_dom_read', capturedAt: new Date().toISOString(), fields,
    sourceState: tidy(command?.textContent), statuses, transactionControls,
    sharedEvidence: shared ? [...shared.querySelectorAll('li')].map(element => tidy(element.textContent))
      .filter(text => /^(schedule|identities|availability):/.test(text)).map(text => text.slice(0, 1800)) : [],
    providerLimitations: provider ? [...provider.querySelectorAll('li')].map(element => tidy(element.textContent))
      .filter(text => !/^Roster player /.test(text)).slice(0, 12).map(text => text.slice(0, 800)) : [],
    note: 'Controls and rendered messages only; no snapshot body, storage, authentication or requests inspected. Uncommitted time-zone text may differ from the active context.' }, null, 2);
})()
