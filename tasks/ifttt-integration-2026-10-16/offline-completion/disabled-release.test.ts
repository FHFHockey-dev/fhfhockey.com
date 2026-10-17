// @vitest-environment node
import { afterEach,describe,expect,it,vi } from "../../../web/node_modules/vitest";
import { persistTweetClaimSources,deliverTweetClaim } from "../../../web/lib/sources/tweetClaimRegistry";
import { admitTweetClaimEvaluationIntake } from "../../../web/lib/sources/tweetClaimEvaluationIntake";
import { persistTweetProjectionReports } from "../../../web/lib/sources/tweetProjectionStorage";

describe("schema-independent disabled claim release",()=>{
  afterEach(()=>vi.unstubAllEnvs());
  it.each([undefined,"off","false"])("does not touch claim/cohort storage when mode is %s",async mode=>{
    vi.stubEnv("TWEET_CLAIMS_MODE",mode);
    // Leftover invalid cohort values must not activate intake or query missing SQL.
    vi.stubEnv("TWEET_CLAIMS_EVALUATION_ID","must-not-activate");
    vi.stubEnv("TWEET_CLAIMS_EVALUATION_START_AT","invalid");
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED","true");
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED","false");
    const db={rpc:vi.fn(),from:vi.fn()},sink={idempotency:"durable_action_key" as const,send:vi.fn(),reconcile:vi.fn()};
    expect(await persistTweetClaimSources(db,[{} as any])).toEqual({skipped:true,scopes:[]});
    const receipts=[{id:"fixture-raw"}];
    expect(await admitTweetClaimEvaluationIntake(db,"line_source_ifttt_events",receipts)).toMatchObject({active:false,events:receipts});
    await persistTweetProjectionReports(db,[{} as any]);
    expect(await deliverTweetClaim({db,key:"fixture-action",sink})).toEqual({status:"disabled"});
    expect(db.rpc).not.toHaveBeenCalled();expect(db.from).not.toHaveBeenCalled();
    expect(sink.send).not.toHaveBeenCalled();expect(sink.reconcile).not.toHaveBeenCalled();
  });
});
