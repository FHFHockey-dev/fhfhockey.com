import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
const session=vi.hoisted(()=>vi.fn());
vi.mock("lib/supabase/client",()=>({default:{auth:{getSession:session,onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}}}));
vi.mock("next/router",()=>({useRouter:()=>({query:{},pathname:"/account",replace:vi.fn()})}));
import DraftProPanel from "./DraftProPanel";
const account={access:{eligible:false,grantingSources:[],expiresAt:null,verifiedAt:null,reason:"no_grant",providerReadiness:{}},passInfo:{priceCents:599,expiresAt:"2027-07-01T04:00:00Z",renewal:"none"},checkoutAvailability:{available:true,reason:"available"},configurationReadiness:{stripe:true,patreon:false,yahoo:false},purchases:[],refundRequests:[],savedDrafts:[],privateImports:[]};
beforeEach(()=>session.mockResolvedValue({data:{session:{access_token:"fixture-token",user:{id:"A"}}}}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe("checkout privacy without billing policy change",()=>{
 it.each([400,401,429,500])("does not render private server text for status%s",async status=>{const f=vi.fn(async(url:string)=>url.endsWith("/checkout")?{ok:false,status,json:async()=>({error:{code:"PRIVATE_CODE",message:"PRIVATE_DETAIL"}})}:{ok:true,status:200,json:async()=>({data:account})});vi.stubGlobal("fetch",f);render(<DraftProPanel/>);fireEvent.click(await screen.findByRole("button",{name:"Get Draft Pro — $5.99 one-time"}));await screen.findByText(status===401?"Sign in before purchasing Draft Pro.":status===429?"Too many checkout attempts. Wait a minute, then try again.":"Checkout could not be started. Try again later, or contact support if it keeps happening.");expect(document.body.textContent).not.toContain("PRIVATE");expect(f.mock.calls.filter(([u])=>u.endsWith("/checkout"))).toHaveLength(1);});
 it("leaves checkout unavailable when the existing server flag denies it",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,status:200,json:async()=>({data:{...account,checkoutAvailability:{available:false,reason:"checkout_disabled"}}})})));render(<DraftProPanel/>);await screen.findByText("Checkout is not available right now.");expect(screen.queryByRole("button",{name:/Get Draft Pro/})).toBeNull();});
 it("preserves an existing waiting checkout reply",async()=>{vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.endsWith("/checkout")?{ok:true,status:200,json:async()=>({state:"waiting"})}:{ok:true,status:200,json:async()=>({data:account})}));render(<DraftProPanel/>);fireEvent.click(await screen.findByRole("button",{name:/Get Draft Pro/}));await waitFor(()=>expect(document.body.textContent).toContain("Checkout is still open or confirming."));});
});
