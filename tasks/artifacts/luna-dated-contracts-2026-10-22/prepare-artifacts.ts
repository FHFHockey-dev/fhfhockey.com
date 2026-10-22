import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import publicEvidence from './PUBLIC-EVIDENCE.json';
import prepared from '../luna-identity-offline-2026-10-20/acronym-continuation/PREPARED-INPUT.json';
import raw from '../luna-identity-offline-2026-10-20/acronym-continuation/RAW-PROPOSALS.json';
import clause from './S06-CLAUSE.json';
import { mapSavedProvenance, type SavedPublicEvidence } from './map-saved-provenance';
import { prepareReplacementReview } from './replacement-contract';
import type { FixtureIdentityRequest } from '../../../web/lib/sources/tweetIdentityProposal';

const evidence = publicEvidence as SavedPublicEvidence;
const atSource = mapSavedProvenance(evidence, '2026-10-22T00:00:00Z', prepared.content.source.publishedAt);
const atReview = mapSavedProvenance(evidence, '2026-10-22T00:00:00Z', '2026-10-22T00:00:00Z');
const replacement = prepareReplacementReview({ enabled: true, request: prepared as unknown as FixtureIdentityRequest, proposal: raw, clause });
if (replacement.status !== 'reviewable_held') throw Error('S06 contract failed');
for (const [name, value] of Object.entries({ 'DATED-SNAPSHOTS.json': { atSource, atReview }, 'REPLACEMENT-REVIEW.json': replacement })) {
  writeFileSync(resolve(__dirname, name), JSON.stringify(value, null, 2) + '\n');
}
process.stdout.write('Prepared two strict dated projections and one held S06 replacement review; zero transports.\n');
