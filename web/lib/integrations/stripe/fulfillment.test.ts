import { beforeEach, describe, expect, it, vi } from "vitest";
import { fulfillStripeProviderEvent, verifyStripeCheckoutSession } from "./fulfillment";

const session: any = { object:"checkout.session",id:"cs_test",created:1,mode:"payment",payment_status:"paid",amount_total:599,currency:"usd",client_reference_id:"purchase-1",payment_intent:"pi_1",metadata:{draft_pro_user_id:"user-1",draft_pro_purchase_id:"purchase-1",draft_pro_season:"draft_pro_2026_27"} };
const item:any = { quantity:1,price:{id:"price_test",product:"prod_test",unit_amount:599,currency:"usd"} };
function harness() {
  const rpc=vi.fn().mockResolvedValue({data:[{purchase_id:"purchase-1",processed:true}],error:null});
  const stripe:any={checkout:{sessions:{retrieve:vi.fn().mockResolvedValue(session),listLineItems:vi.fn().mockResolvedValue({data:[item]})}},charges:{retrieve:vi.fn().mockResolvedValue({id:"ch_1",amount:599,amount_refunded:599,payment_intent:"pi_1"})},paymentIntents:{retrieve:vi.fn().mockResolvedValue({metadata:{draft_pro_user_id:"user-1",draft_pro_purchase_id:"purchase-1"}})}};
  return {stripe,rpc,client:{rpc} as any};
}
beforeEach(()=>{process.env.STRIPE_DRAFT_PRO_PRICE_ID="price_test";process.env.STRIPE_DRAFT_PRO_PRODUCT_ID="prod_test";});

describe("Stripe provider adapter",()=>{
  it.each([["price",{...item,price:{...item.price,id:"bad"}}],["product",{...item,price:{...item.price,product:"bad"}}],["quantity",{...item,quantity:2}]])("rejects wrong %s without RPC",async(_label,bad)=>{const h=harness();h.stripe.checkout.sessions.listLineItems.mockResolvedValue({data:[bad]});await fulfillStripeProviderEvent({event:{id:"evt",type:"checkout.session.completed",created:1,data:{object:{id:"cs_test"}}} as any,stripe:h.stripe,client:h.client});expect(h.rpc).not.toHaveBeenCalled();});
  it.each([[599,true],[100,false]])("normalizes refund fullness",async(amountRefunded,full)=>{const h=harness();h.stripe.charges.retrieve.mockResolvedValue({id:"ch_1",amount:599,amount_refunded:amountRefunded,payment_intent:"pi_1"});await fulfillStripeProviderEvent({event:{id:"evt",type:"charge.refunded",created:1,data:{object:{id:"ch_1",metadata:{}}}} as any,stripe:h.stripe,client:h.client});expect(h.rpc).toHaveBeenCalledWith("record_draft_pro_stripe_event",expect.objectContaining({p_user_id:"user-1",p_purchase_id:"purchase-1",p_full_refund:full}));});
  it.each([["charge.dispute.created","needs_response","open","disputed"],["charge.dispute.closed","won","won","dispute_won"],["charge.dispute.closed","lost","lost","disputed"]])("normalizes %s",async(type,providerStatus,status,paymentState)=>{const h=harness();await fulfillStripeProviderEvent({event:{id:"evt",type,created:1,data:{object:{id:"dp_1",charge:"ch_1",status:providerStatus}}} as any,stripe:h.stripe,client:h.client});expect(h.rpc).toHaveBeenCalledWith("record_draft_pro_stripe_event",expect.objectContaining({p_dispute_status:status,p_payment_state:paymentState}));});
  it("uses catalog verification on return",async()=>{const h=harness();await verifyStripeCheckoutSession(h.stripe,session,h.client);expect(h.stripe.checkout.sessions.listLineItems).toHaveBeenCalled();expect(h.rpc).toHaveBeenCalledTimes(1);});
});
