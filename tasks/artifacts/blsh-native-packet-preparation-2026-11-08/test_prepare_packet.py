"""Synthetic-only integration tests. No actual request, receipt or reserve is read."""
import argparse
import base64
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlencode

import prepare_packet as packet

AT = '2026-11-08T12:00:00Z'
PINS = json.loads((packet.ROOT / 'SOURCE-PINS.json').read_text())
VALIDATORS, _ = packet.load_validators(Path(PINS['intake']['path']), Path(PINS['lineage']['path']))


def seed():
    def feed(source):
        return {'source': source, 'sha256': 'a' * 64, 'retrievedAtUTC': '2026-11-08T10:00:00Z',
                'sourceAvailableThroughUTC': None, 'revisionId': None}
    counts = {key: 0 for key in ['goals', 'assists', 'pp_points', 'shots', 'hits', 'blocked_shots',
              'total_primary_assists', 'total_secondary_assists', 'penalties_drawn', 'penalties',
              'total_fow', 'total_fol', 'sat_for', 'sat_against', 'es_goals_for', 'pp_goals_for',
              'sh_goals_for', 'es_goals_against', 'pp_goals_against', 'sh_goals_against', 'points']}
    counts['shots'] = 0.0  # Python and JS stringify differently; use the actual gate's hash.
    request = {'seasonId': 20262027, 'eventThroughDate': '2026-11-07', 'asOfUTC': AT,
               'freshnessPolicy': {'id': 'synthetic-only', 'maxEventAgeDays': 7, 'maxCaptureAgeHours': 24},
               'calendar': {'capture': feed('public.games'), 'rows': [{'id': 2026020001, 'seasonId': 20262027, 'date': '2026-11-07', 'type': 2}]},
               'wgo': {'capture': feed('public.wgo_skater_stats'), 'rows': [{'id': 1, 'player_id': 8470001, 'game_id': 2026020001,
                       'season_id': 20262027, 'date': '2026-11-07', 'player_name': 'Synthetic Only', 'team_abbrev': 'TST',
                       'position_code': 'F', 'games_played': 1, 'toi_per_game': 900, 'es_toi_per_game': 800, 'pp_toi_per_game': 100, 'counts': counts}]}}
    for group, source, metrics, sid in [('individual', 'public.nst_gamelog_as_counts', {'ixg': .25, 'goals': 0, 'shots': 0}, 2),
                                      ('onIce', 'public.nst_gamelog_as_counts_oi', {'xgf': .75, 'xga': .5}, 3)]:
        request[group] = {'capture': feed(source), 'strengthScope': 'unknown', 'dateMeaning': 'unknown', 'toiUnit': 'unknown',
                          'rows': [{'id': sid, 'player_id': 8470001, 'season': 20262027, 'date_scraped': '2026-11-07', 'gp': 1, 'toi': 900, **metrics}]}
    return {'request': request, 'context': {'profiles': [{'playerId': 8470001, 'name': 'Synthetic Only', 'sourceIds': [1], 'shots': 0}]},
            'frame': {'seasonId': 20262027, 'playerId': 8470001, 'gameId': 2026020001, 'date': '2026-11-07', 'team': 'TST',
                      'final': True, 'gamesPlayed': 1, 'totalToiSeconds': 900, 'completedByUTC': '2026-11-07T23:00:00Z',
                      'observedAtUTC': '2026-11-08T10:05:00Z', 'gamesOnNativeDate': 1, 'dateMembershipComplete': True},
            'cells': {'individual': ['15:00', '1', '0', '0', '0.25'], 'onIce': ['15.00', '1', '0.75', '0.5']},
            'receiptOverrides': {}, 'extraTable': False}


def fixture(change=None):
    s = seed()
    if change: change(s)
    artifacts = {}
    def add(data):
        digest = packet.sha(data); artifacts[digest] = data; return digest
    producer = add(b'SYNTHETIC TEST PRODUCER, not real capture code')
    redactor = add(b'SYNTHETIC TEST REDACTOR, not verified redaction')
    definition = add(b'SYNTHETIC model definition, never accepted for real data')
    frame = add(packet.encode(s['frame']))
    entries = []
    for group in packet.GROUPS:
        headers = ['TOI', 'GP', 'Goals', 'Shots', 'ixG'] if group == 'individual' else ['TOI', 'GP', 'xGF', 'xGA']
        head = '<thead><tr><th>Player</th><th>Team</th>' + ''.join('<th>' + h + '</th>' for h in headers) + '</tr></thead>'
        row = '<tbody><tr><td><a href="playerreport.php?playerid=8470001">Synthetic Only</a></td><td>TST</td>' + ''.join('<td>' + v + '</td>' for v in s['cells'][group]) + '</tr></tbody>'
        body = ('<!-- SYNTHETIC ONLY -->\r\n<table>' + head + row + '</table>' + ('<table></table>' if s['extraTable'] else '')).encode()
        body_sha = add(body)
        url = 'https://data.naturalstattrick.com/playerteams.php?' + urlencode({'fromseason': '20262027', 'thruseason': '20262027',
              'stype': '2', 'sit': 'all', 'score': 'all', 'stdoi': 'std' if group == 'individual' else 'oi', 'rate': 'n', 'team': 'ALL',
              'pos': 'S', 'loc': 'B', 'toi': '0', 'gpfilt': 'gpdate', 'fd': '2026-11-07', 'td': '2026-11-07', 'lines': 'single', 'draftteam': 'ALL'})
        receipt = {'url': url, 'status': 'success', 'httpStatus': 200, 'TLSVerified': True, 'representation': 'parser_input_after_redaction',
                   'parserInputSHA256': body_sha, 'parserInputBytes': len(body), 'producerSHA256': producer, 'redactorSHA256': redactor,
                   'toiParsingContract': 'minutes_decimal_or_mmss_to_seconds_half_up', 'retrievedAtUTC': '2026-11-08T10:00:00Z', **s['receiptOverrides']}
        entries.append({'group': group, 'wgoSourceId': 1, 'processSourceId': 2 if group == 'individual' else 3,
                        'nativeBodySHA256': body_sha, 'nativeReceiptSHA256': add(packet.encode(receipt)), 'producerSHA256': producer,
                        'redactorSHA256': redactor, 'definitionSHA256': definition, 'officialFrameSHA256': frame})
    request, context = packet.encode(s['request']), packet.encode(s['context'])
    allowlist = {'producerSHA256': [producer], 'redactorSHA256': [redactor]}
    manifest = {'version': 'fhfh.blsh.native-packet-inputs.v1', 'sourceRequestSHA256': packet.sha(request), 'contextSHA256': packet.sha(context),
                'producerAllowlistSHA256': packet.sha(packet.encode(allowlist)), 'artifacts': [], 'rows': entries}
    return {'request':request, 'context':context, 'manifest':manifest, 'artifacts':artifacts, 'allowlist':allowlist}


def run(f, at=AT):
    return packet.compose(f['request'], f['context'], f['manifest'], f['artifacts'], f['allowlist'], at, VALIDATORS)


def synthetic_gate_cases(cases):
    # Test-only policies, never saved as real/server acceptance. Use the pinned gate unchanged.
    review = b'SYNTHETIC REVIEW FOR TEST ONLY'; review_sha = packet.sha(review)
    data = []
    for f, proposal in cases:
        artifacts = {**f['artifacts'], review_sha: review}
        bundle = packet.encode(proposal)
        policy = {'acceptances': [{'bundleSHA256': packet.sha(bundle), 'requestSHA256': packet.sha(f['request']), 'reviewSHA256': review_sha,
                                  'reviewScope': 'exact_rows_native_cells_scope_and_model', 'requiredArtifactSHA256': list(artifacts)}]}
        data.append({'request':base64.b64encode(f['request']).decode(), 'bundle':base64.b64encode(bundle).decode(), 'policy':policy,
                     'artifacts':{k:base64.b64encode(v).decode() for k,v in artifacts.items()}, 'at':AT})
    code = """const fs=require('node:fs');const {loadGate}=require(process.argv[1]);const g=loadGate();
const results=JSON.parse(fs.readFileSync(0,'utf8')).map(d=>{
  const a=new Map(Object.entries(d.artifacts).map(([k,v])=>[k,Buffer.from(v,'base64')]));
  const r=g.createCurrentProcessEvidenceGate(d.policy)(Buffer.from(d.request,'base64'),d.at,Buffer.from(d.bundle,'base64'),a);
  return {coverage:r.coverage,closed:g.CLOSED_PROCESS_EVIDENCE_POLICY.acceptances.length,
    reasons:r.records.flatMap(row=>[...row.individual.provenance.reasons,...row.onIce.provenance.reasons])};
});process.stdout.write(JSON.stringify(results));"""
    checked = subprocess.run(['node', '-e', code, str(packet.ROOT/'closed_gate.cjs')], input=json.dumps(data).encode(), capture_output=True, check=True)
    return json.loads(checked.stdout)


def materialize(folder, f):
    (folder / 'inputs').mkdir()
    for digest, data in f['artifacts'].items():
        (folder / 'inputs' / digest).write_bytes(data)
    f['manifest']['artifacts'] = [{'path': 'inputs/' + digest, 'sha256': digest, 'bytes': len(data)} for digest, data in f['artifacts'].items()]
    for name, data in [('request.json', f['request']), ('context.json', f['context']), ('receipt-manifest.json', packet.encode(f['manifest'])),
                       ('allowlist.json', packet.encode(f['allowlist']))]:
        (folder / name).write_bytes(data)
    return argparse.Namespace(request=folder/'request.json', context=folder/'context.json', receipt_manifest=folder/'receipt-manifest.json',
                              producer_allowlist=folder/'allowlist.json', intake_source=Path(PINS['intake']['path']),
                              lineage_source=Path(PINS['lineage']['path']), evaluated_at=AT, out=folder/'output')


class PreparationTests(unittest.TestCase):
    def test_exact_bundle_replays_closed_and_matches_real_gate_under_synthetic_test_policy(self):
        f = fixture(); before = copy.deepcopy(f); result = run(f)
        self.assertEqual(f, before)
        self.assertEqual(result['summary']['proposedWitnesses'], 2)
        self.assertEqual(result['replay']['coverage']['individualQualified'], 0)
        self.assertEqual(result['replay']['defaultPolicyAcceptedBundles'], 0)
        self.assertFalse(result['replay']['capturedWindows'][0]['currentUseQualified'])
        output = synthetic_gate_cases([(f, result['bundle'])])[0]
        self.assertEqual(output['coverage']['individualQualified'], 1)
        self.assertEqual(output['coverage']['onIceQualified'], 1)
        self.assertEqual(output['closed'], 0)
        naive = packet.sha(json.dumps(json.loads(f['request'])['wgo']['rows'][0], sort_keys=True, separators=(',', ':')).encode())
        self.assertNotEqual(naive, result['bundle']['witnesses'][0]['wgoRowSHA256'])

    def test_invalid_receipt_and_frame_clocks_match_the_real_gate(self):
        invalid = ['2026-11-08 09:00:00Z', '2026-11-08T09:00:00', '2026-11-08T09:00:00.1234567Z',
                   '2026-11-08T09:00:00+00:00:30', '2026-11-08T10:00:00+00:60', '2026-11-08T23:00:00+13:60',
                   '2026-11-08T23:01:00+14:01', '2026-11-07T18:59:00-14:01', '2026-11-08T09:00:00-00:00',
                   '2026-11-08T24:00:00Z', '2026-11-08T09:60:00Z', '2026-11-08T09:00:60Z',
                   '2026-11-08T09:00:00,1Z', '2026-02-30T09:00:00Z']
        base = run(fixture())['bundle']; cases = []
        for owner, key in [('receiptOverrides', 'retrievedAtUTC'), ('frame', 'completedByUTC'), ('frame', 'observedAtUTC')]:
            for value in invalid:
                f = fixture(lambda s:s[owner].__setitem__(key,value))
                # Rebind original synthetic witnesses to the changed artifact hashes, so the gate
                # independently checks the bad clock instead of merely seeing an empty proposal.
                bundle = {**base, 'witnesses': [{**w, **entry} for w,entry in zip(base['witnesses'],f['manifest']['rows'])]}
                cases.append((owner,key,value,f,bundle))
        checked = synthetic_gate_cases([(f,bundle) for _,_,_,f,bundle in cases])
        for (owner,key,value,f,_), gated in zip(cases,checked):
            with self.subTest(owner=owner,key=key,value=value):
                self.assertEqual(gated['coverage']['individualQualified'],0)
                self.assertEqual(gated['coverage']['onIceQualified'],0)
                self.assertIn('invalid_evidence_time',gated['reasons'])
                r = run(f)
                self.assertEqual(r['summary']['proposedWitnesses'],0)
                self.assertTrue(all(d['state']=='held' for d in r['decisions']))

    def test_valid_clock_precision_and_offset_boundaries_preserve_bytes_and_match_gate(self):
        valid = ['2026-11-08T09:00:00Z', '2026-11-08T09:00:00+00:00', '2026-11-08T23:00:00+14:00',
                 '2026-11-07T19:00:00-14:00', '2026-11-08T22:59:00+13:59', '2026-11-07T19:01:00-13:59']
        valid += ['2026-11-08T09:00:00.'+'123456'[:digits]+'Z' for digits in range(1,7)]
        cases = []
        for value in valid:
            def clocks(s):
                s['receiptOverrides']['retrievedAtUTC']=value
                s['frame'].update(completedByUTC=value,observedAtUTC=value)
            f = fixture(clocks); before=copy.deepcopy(f); r=run(f)
            with self.subTest(value=value):
                self.assertEqual(f,before)
                self.assertEqual(r['summary']['proposedWitnesses'],2)
                self.assertEqual(r['replay']['coverage']['individualQualified'],0)
                self.assertEqual(r['replay']['coverage']['onIceQualified'],0)
            cases.append((f,r['bundle']))
        for value,gated in zip(valid,synthetic_gate_cases(cases)):
            with self.subTest(value=value):
                self.assertEqual(gated['coverage']['individualQualified'],1)
                self.assertEqual(gated['coverage']['onIceQualified'],1)
                self.assertEqual(gated['closed'],0)

    def test_native_placeholder_and_discrepancy_cannot_pass_on_structural_success(self):
        for value in ['-', '', '0.26']:
            with self.subTest(value=value):
                f = fixture(lambda s: s['cells']['individual'].__setitem__(4, value)); result = run(f)
                self.assertEqual(result['decisions'][0]['lineage']['state'], 'row_lineage_checked_proposed_contract')
                self.assertEqual(result['decisions'][0]['state'], 'held')
                self.assertEqual(result['decisions'][0]['reasons'], ['native_fields_not_literal_match:ixg'])
                self.assertEqual([w['group'] for w in result['bundle']['witnesses']], ['onIce'])

    def test_missing_group_preserves_successful_other_group(self):
        f=fixture(); f['manifest']['rows']=f['manifest']['rows'][:1]; r=run(f)
        self.assertEqual(r['summary']['proposedWitnesses'],1)
        self.assertEqual(r['decisions'][1]['reasons'],['native_receipt_not_supplied'])

    def test_no_receipts_produces_only_holds_with_zero_admissions(self):
        f=fixture();f['manifest']['rows']=[];f['artifacts']={};r=run(f)
        self.assertEqual(r['summary']['proposedWitnesses'],0)
        self.assertEqual(r['summary']['heldGroups'],2)
        self.assertEqual(r['summary']['holdReasons'],{'native_receipt_not_supplied':2})
        self.assertEqual(r['replay']['coverage']['individualQualified'],0)

    def test_missing_stored_value_and_exposure_disagreement_remain_held(self):
        for field,value in [('ixg',None),('toi',901)]:
            with self.subTest(field=field):
                f=fixture(lambda s:s['request']['individual']['rows'][0].__setitem__(field,value)); r=run(f)
                self.assertEqual(r['decisions'][0]['state'],'held'); self.assertIsNone(r['decisions'][0]['lineage'])

    def test_explicit_zero_is_a_literal_match(self):
        r=run(fixture()); self.assertEqual(r['decisions'][0]['lineage']['fields']['shots']['nativeValue'],0)
        self.assertEqual(r['decisions'][0]['lineage']['fields']['shots']['state'],'literal_match')

    def test_changed_process_id_is_not_rebound_to_a_different_row(self):
        f=fixture();f['manifest']['rows'][0]['processSourceId']=123; r=run(f)
        self.assertEqual(r['decisions'][0]['reasons'],['process_row_binding_mismatch'])

    def test_duplicate_and_unselected_entries_fail_without_producing_output(self):
        for kind in ['duplicate','unselected']:
            with self.subTest(kind=kind):
                f=fixture()
                if kind=='duplicate':f['manifest']['rows'].append(copy.deepcopy(f['manifest']['rows'][0]))
                else:f['manifest']['rows'][0]['wgoSourceId']=7
                with self.assertRaises(packet.PreparationError):run(f)

    def test_wrong_or_unestablished_official_frame_stays_held(self):
        for key,value,reason in [('playerId',8470999,'official_frame_identity_mismatch'),('totalToiSeconds',899,'official_exposure_hold'),
                                 ('dateMembershipComplete',False,'official_player_date_membership_unestablished'),
                                 ('observedAtUTC','2026-11-09T00:00:00Z','official_frame_chronology_unqualified')]:
            with self.subTest(key=key):
                r=run(fixture(lambda s:s['frame'].__setitem__(key,value)))
                self.assertEqual(r['summary']['proposedWitnesses'],0);self.assertEqual(r['decisions'][0]['reasons'],[reason])

    def test_ambiguous_tables_bad_transport_and_future_receipts_are_held(self):
        variants=[lambda s:s.__setitem__('extraTable',True),lambda s:s['receiptOverrides'].update(TLSVerified=False),
                  lambda s:s['receiptOverrides'].update(retrievedAtUTC='2026-11-09T00:00:00Z')]
        for change in variants:
            with self.subTest(change=change):self.assertEqual(run(fixture(change))['summary']['proposedWitnesses'],0)

    def test_supplied_allowlist_is_required_and_never_becomes_server_acceptance(self):
        f=fixture();f['allowlist']['producerSHA256']=[];r=run(f)
        self.assertEqual(r['summary']['proposedWitnesses'],0)
        self.assertEqual(r['decisions'][0]['reasons'],['producer_version_unreviewed'])
        self.assertEqual(r['replay']['defaultPolicyAcceptedBundles'],0)

    def test_later_replay_keeps_original_clocks_and_diagnoses_stale_window(self):
        f=fixture();r=run(f,'2026-11-20T12:00:00Z')
        self.assertEqual(r['decisions'][0]['lineage']['capturedAtUTC'],'2026-11-08T10:00:00Z')
        self.assertEqual(r['summary']['sourceRequestAsOfUTC'],AT)
        self.assertEqual(r['replay']['capturedWindows'][0]['recency']['state'],'stale')
        self.assertEqual(r['summary']['sourceAdmissions'],0)

    def test_artifact_drift_path_escape_symlink_and_bounds_fail(self):
        for variant in ['drift','escape','symlink','oversize']:
            with self.subTest(variant=variant), tempfile.TemporaryDirectory() as temp:
                folder=Path(temp);f=fixture();args=materialize(folder,f);entry=f['manifest']['artifacts'][0]
                if variant=='drift':(folder/entry['path']).write_bytes(b'changed')
                elif variant=='escape':entry['path']='../unlisted'
                elif variant=='oversize':entry['bytes']=8*packet.MIB+1
                else:
                    original=folder/entry['path'];data=original.read_bytes();original.unlink();(folder/'target').write_bytes(data);original.symlink_to(folder/'target')
                args.receipt_manifest.write_bytes(packet.encode(f['manifest']))
                with self.assertRaises((packet.PreparationError,OSError)):packet.prepare(args)
                self.assertFalse(args.out.exists())

    def test_changed_validator_fails_before_execution(self):
        with tempfile.TemporaryDirectory() as temp:
            changed=Path(temp)/'intake.py';changed.write_text('raise RuntimeError("MUST NOT EXECUTE")')
            with self.assertRaisesRegex(packet.PreparationError,'validator_source_drift'):
                packet.load_validators(changed,Path(PINS['lineage']['path']))

    def test_changed_input_and_allowlist_pins_fail_before_artifact_reads(self):
        for name in ['request','context','producer_allowlist']:
            with self.subTest(name=name),tempfile.TemporaryDirectory() as temp:
                folder=Path(temp);f=fixture();args=materialize(folder,f);p=getattr(args,name)
                p.write_bytes(p.read_bytes()+b'\n')
                with patch.object(packet,'artifacts_from',side_effect=AssertionError('must not read artifacts')):
                    with self.assertRaises(packet.PreparationError):packet.prepare(args)
                self.assertFalse(args.out.exists())

    def test_non_current_request_stops_before_context_or_artifact_intake(self):
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp);f=fixture();args=materialize(folder,f)
            request=json.loads(f['request']);request['seasonId']=20252026;args.request.write_bytes(packet.encode(request))
            args.context.unlink()
            with self.assertRaisesRegex(packet.PreparationError,'outside_current_season'):packet.prepare(args)
            self.assertFalse(args.out.exists())

    def test_interrupted_write_keeps_partial_files_without_completion_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp);f=fixture();args=materialize(folder,f);original=packet.os.open
            def fail_bundle(path,*values):
                if Path(path).name=='PROPOSED-BUNDLE.json':raise PermissionError('synthetic failure')
                return original(path,*values)
            with patch.object(packet.os,'open',side_effect=fail_bundle):
                with self.assertRaises(PermissionError):packet.prepare(args)
            self.assertTrue((args.out/'STARTED.json').exists())
            self.assertEqual((args.out/'CURRENT-REQUEST.json').read_bytes(),f['request'])
            self.assertFalse((args.out/'MANIFEST.json').exists())

    def test_mid_manifest_write_failure_never_publishes_a_completion_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            args=materialize(Path(temp),fixture()); original_open=packet.os.open; original_fdopen=packet.os.fdopen
            manifest_fd=None
            def track_open(path,*values):
                nonlocal manifest_fd
                fd=original_open(path,*values)
                if Path(path).name in ['MANIFEST.json','.MANIFEST.json.tmp']:manifest_fd=fd
                return fd
            def fail_mid_write(fd,*values):
                handle=original_fdopen(fd,*values)
                if fd!=manifest_fd:return handle
                class InterruptedManifest:
                    def __enter__(self):return self
                    def __exit__(self,*_args):handle.close()
                    def write(self,data):
                        handle.write(data[:13]);handle.flush()
                        raise OSError('synthetic mid-manifest failure')
                return InterruptedManifest()
            with patch.object(packet.os,'open',side_effect=track_open),patch.object(packet.os,'fdopen',side_effect=fail_mid_write):
                with self.assertRaisesRegex(OSError,'synthetic mid-manifest failure'):packet.prepare(args)
            self.assertFalse((args.out/'MANIFEST.json').exists())
            self.assertEqual((args.out/'.MANIFEST.json.tmp').stat().st_size,13)
            self.assertTrue((args.out/'STARTED.json').exists())

    def test_manifest_publication_requires_fsync_and_does_not_overwrite(self):
        for failure in ['fsync','existing_final',None]:
            with self.subTest(failure=failure),tempfile.TemporaryDirectory() as temp:
                args=materialize(Path(temp),fixture()); original_sync=packet.os.fsync; original_link=packet.os.link
                synced=False;published=False
                def sync(fd):
                    nonlocal synced
                    if failure=='fsync':raise OSError('synthetic fsync failure')
                    original_sync(fd);synced=True
                def publish(source,target,*values,**kwargs):
                    nonlocal published
                    self.assertTrue(synced)
                    manifest=json.loads(Path(source).read_bytes())
                    self.assertEqual(manifest['status'],'offline_proposal_written_not_accepted')
                    for pin in manifest['files']:
                        self.assertEqual(packet.sha((args.out/pin['path']).read_bytes()),pin['sha256'])
                    if failure=='existing_final':Path(target).write_bytes(b'preexisting manifest')
                    original_link(source,target,*values,**kwargs);published=True
                with patch.object(packet.os,'fsync',side_effect=sync),patch.object(packet.os,'link',side_effect=publish):
                    if failure:
                        with self.assertRaises(OSError):packet.prepare(args)
                    else:packet.prepare(args)
                self.assertEqual(published,failure is None)
                if failure=='fsync':self.assertFalse((args.out/'MANIFEST.json').exists())
                elif failure=='existing_final':self.assertEqual((args.out/'MANIFEST.json').read_bytes(),b'preexisting manifest')
                else:self.assertFalse((args.out/'.MANIFEST.json.tmp').exists())

    def test_json_duplicate_keys_and_unsafe_numbers_are_rejected(self):
        for data in [b'{"x":1,"x":2}',b'{"x":9007199254740993}',b'{"x":NaN}',b'{"x":1e999}']:
            with self.subTest(data=data),self.assertRaises(packet.PreparationError):packet.parse(data)

    def test_cli_retains_exact_bytes_and_immutable_proposal_from_another_cwd(self):
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp);f=fixture();args=materialize(folder,f)
            cmd=[sys.executable,str(packet.ROOT/'prepare_packet.py')]
            for name,value in vars(args).items():cmd.extend(['--'+name.replace('_','-'),str(value)])
            result=subprocess.run(cmd,cwd='/tmp',capture_output=True,check=True)
            self.assertEqual(json.loads(result.stdout)['proposedWitnesses'],2)
            self.assertEqual((args.out/'CURRENT-REQUEST.json').read_bytes(),f['request'])
            for digest,data in f['artifacts'].items():self.assertEqual((args.out/'artifacts'/digest).read_bytes(),data)
            manifest=json.loads((args.out/'MANIFEST.json').read_bytes())
            for pin in manifest['files']:self.assertEqual(packet.sha((args.out/pin['path']).read_bytes()),pin['sha256'])
            self.assertEqual(args.out.stat().st_mode & 0o777,0o700)
            self.assertEqual((args.out/'SUMMARY.json').stat().st_mode & 0o777,0o600)
            self.assertFalse(any('ACCEPTANCE' in p.name for p in args.out.iterdir()))
            before=(args.out/'MANIFEST.json').read_bytes()
            retry=subprocess.run(cmd,cwd='/tmp',capture_output=True)
            self.assertNotEqual(retry.returncode,0);self.assertEqual((args.out/'MANIFEST.json').read_bytes(),before)


if __name__=='__main__':
    def offline(event,_args):
        if event.startswith('socket.'):raise RuntimeError('test_network_denied')
    sys.addaudithook(offline)
    unittest.main()
