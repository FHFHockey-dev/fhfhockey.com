import { beforeEach, describe, expect, it, vi } from "vitest";
const auth=vi.hoisted(()=>vi.fn()); const retrieve=vi.hoisted(()=>vi.fn()); const fulfill=vi.hoisted(()=>vi.fn()); const access=vi.hoisted(()=>vi.fn()); const state=vi.hoisted(()=>({status:"active"}));
const query:any=vi.hoisted(()=>({select:vi.fn(()=>query),eq:vi.fn(()=>query),maybeSingle:vi.fn(async()=>({data:{id:"p1",status:state.status}}))}));
vi.mock("lib/api/requireApiUser",()=>({requireApiUser:auth})); vi.mock("lib/supabase/server",()=>({default:{from:()=>query}})); vi.mock("lib/draft-pro/server",()=>({loadDraftProAccess:access}));
vi.mock("lib/integrations/stripe/config",()=>({isStripeConfigured:()=>true,getStripeClient:()=>({checkout:{sessions:{retrieve}}})}));
vi.mock("lib/integrations/stripe/fulfillment",()=>({checkoutUserId:(s:any)=>s.metadata?.draft_pro_user_id,verifyStripeCheckoutSession:fulfill}));
vi.mock("lib/draft-pro/recommendationsRateLimit",()=>({consumeRecommendationRequest:()=>true}));
import handler from "../../../pages/api/v1/account/draft-pro/checkout/verify";
const res=()=>{const s:any={};return Object.assign(s,{status(n:number){s.statusCode=n;return s},json(body:any){s.body=body;return s},setHeader:vi.fn()})};
describe("checkout verify states",()=>{beforeEach(()=>{vi.clearAllMocks();auth.mockResolvedValue({id:"u1"});state.status="active";access.mockResolvedValue({eligible:true});fulfill.mockResolvedValue({purchaseId:"p1",processed:false});retrieve.mockResolvedValue({id:"cs_test_1",payment_status:"paid",metadata:{draft_pro_user_id:"u1",draft_pro_purchase_id:"p1"}})});
it.each([["active",true,"paid","confirmed"],["active",false,"paid","confirming"],["refunded",false,"paid","ineligible"],["disputed",false,"paid","ineligible"],["expired",false,"paid","ineligible"],["pending",false,"paid","confirming"],["pending",false,"unpaid","ineligible"]])("maps %s",async(status,eligible,payment,stateName)=>{state.status=status;access.mockResolvedValue({eligible});retrieve.mockResolvedValue({id:"cs_test_1",payment_status:payment,metadata:{draft_pro_user_id:"u1",draft_pro_purchase_id:"p1"}});const r=res();await handler({method:"POST",headers:{},body:{sessionId:"cs_test_1"}} as any,r);expect(r.body.state).toBe(stateName)});
it("rejects another account session",async()=>{retrieve.mockResolvedValue({id:"cs_test_1",metadata:{draft_pro_user_id:"u2"}});const r=res();await handler({method:"POST",headers:{},body:{sessionId:"cs_test_1"}} as any,r);expect(r.statusCode).toBe(403);expect(fulfill).not.toHaveBeenCalled()});
it("expands the payment charge for receipt recovery",async()=>{const r=res();await handler({method:"POST",headers:{},body:{sessionId:"cs_test_1"}} as any,r);expect(retrieve).toHaveBeenCalledWith("cs_test_1",{expand:["payment_intent.latest_charge"]})});});


describe("purchase recovery codes", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ id: "u1" });
    access.mockResolvedValue({ eligible: true });
    fulfill.mockResolvedValue({ purchaseId: id, processed: true });
    query.maybeSingle.mockResolvedValue({ data: { id, status: "active", provider_checkout_session_id: "cs_live_owned" } });
    retrieve.mockResolvedValue({ id: "cs_live_owned", payment_status: "paid", metadata: { draft_pro_user_id: "u1", draft_pro_purchase_id: id }, payment_intent: { latest_charge: { amount: 599, amount_refunded: 0, refunded: false, disputed: false } } });
  });
  const request = () => ({ method: "POST", headers: {}, body: { recoveryCode: `DPRO-${id}` } } as any);
  it("resolves only the account-owned purchase and uses idempotent recovery fulfillment", async () => {
    const r = res(); await handler(request(), r);
    expect(query.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(query.eq).toHaveBeenCalledWith("provider", "stripe");
    expect(retrieve).toHaveBeenCalledWith("cs_live_owned", { expand: ["payment_intent.latest_charge"] });
    expect(fulfill.mock.calls[0][3]).toBe(true);
    expect(r.body.state).toBe("confirmed");
  });
  it("denies an absent or foreign purchase before contacting Stripe", async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null });
    const r = res(); await handler(request(), r);
    expect(r.statusCode).toBe(400); expect(retrieve).not.toHaveBeenCalled(); expect(fulfill).not.toHaveBeenCalled();
  });
  it.each(["refunded", "disputed", "expired", "failed"])("does not reactivate a %s purchase", async (status) => {
    query.maybeSingle.mockResolvedValueOnce({ data: { id, status, provider_checkout_session_id: "cs_live_owned" } });
    const r = res(); await handler(request(), r); expect(r.statusCode).toBe(400); expect(fulfill).not.toHaveBeenCalled();
  });
  it.each([{ amount: 599, amount_refunded: 599 }, { amount: 599, amount_refunded: 0, disputed: true }, null])("rejects unsafe or missing current charge evidence", async (charge) => {
    const session = await retrieve(); retrieve.mockClear(); retrieve.mockResolvedValue({ ...session, payment_intent: { latest_charge: charge } });
    const r = res(); await handler(request(), r); expect(r.statusCode).toBe(400); expect(fulfill).not.toHaveBeenCalled();
  });
  it("does not report access restored when server payment verification fails", async () => {
    fulfill.mockResolvedValue({ purchaseId: null, processed: false });
    const r = res(); await handler(request(), r); expect(r.body.state).toBe("ineligible");
  });
  it("rejects mismatched purchase metadata", async () => {
    const session = await retrieve(); retrieve.mockClear(); retrieve.mockResolvedValue({ ...session, metadata: { draft_pro_user_id: "u1", draft_pro_purchase_id: "other" } });
    const r = res(); await handler(request(), r); expect(r.statusCode).toBe(400); expect(fulfill).not.toHaveBeenCalled();
  });
});
