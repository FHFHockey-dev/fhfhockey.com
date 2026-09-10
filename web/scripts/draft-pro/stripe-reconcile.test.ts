import { beforeEach, describe, expect, it, vi } from "vitest";
const verified=vi.hoisted(()=>vi.fn().mockResolvedValue(true)); const fulfill=vi.hoisted(()=>vi.fn());
vi.mock("lib/integrations/stripe/config",()=>({getStripeClient:vi.fn()})); vi.mock("lib/supabase/server",()=>({default:{}})); vi.mock("lib/integrations/stripe/fulfillment",()=>({verifyDraftProCheckoutSession:verified,verifyStripeCheckoutSession:fulfill}));
import { parseReconcileOptions, runStripeReconciliation } from "./stripe-reconcile";
beforeEach(() => fulfill.mockClear());
const chain:any={select:()=>chain,eq:()=>chain,not:()=>chain,limit:async()=>({data:[{id:"p1",user_id:"u1",provider_checkout_session_id:"cs1"}],error:null})};
const stripe:any={checkout:{sessions:{retrieve:vi.fn().mockResolvedValue({metadata:{draft_pro_purchase_id:"p1",draft_pro_user_id:"u1"}})}}};
describe("Stripe reconciliation",()=>{
it("defaults dry run and rejects unsafe options",()=>{expect(parseReconcileOptions([],{})).toEqual({apply:false,limit:25});for(const args of [["--bad"],["--limit=0"],["--limit=1","--limit=2"],["--apply"]]) expect(()=>parseReconcileOptions(args,{})).toThrow();expect(()=>parseReconcileOptions(["--apply"],{STRIPE_SECRET_KEY:"sk_live_x"})).toThrow();expect(parseReconcileOptions(["--apply"],{STRIPE_SECRET_KEY:"rk_test_x"}).apply).toBe(true)});
it("does not fulfill in dry run and verifies owned apply",async()=>{await expect(runStripeReconciliation({apply:false,limit:1},{stripe,client:{from:()=>chain} as any})).resolves.toMatchObject({dryRun:true});expect(fulfill).not.toHaveBeenCalled();await runStripeReconciliation({apply:true,limit:1},{stripe,client:{from:()=>chain} as any});expect(fulfill).toHaveBeenCalledTimes(1)});
it("skips an owner-mismatched session",async()=>{const wrong={...stripe,checkout:{sessions:{retrieve:vi.fn().mockResolvedValue({metadata:{draft_pro_purchase_id:"p1",draft_pro_user_id:"other"}})}}};await runStripeReconciliation({apply:true,limit:1},{stripe:wrong,client:{from:()=>chain} as any});expect(fulfill).not.toHaveBeenCalled();});
});
