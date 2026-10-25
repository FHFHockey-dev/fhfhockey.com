import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), create: vi.fn() }));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: mocks.auth }));
vi.mock("lib/draft-pro/account/refunds", async original => ({ ...await original<object>(), createDraftProRefundRequest: mocks.create }));
import { DraftProRefundError } from "lib/draft-pro/account/refunds";
import handler from "pages/api/v1/account/draft-pro/refund-requests";
const body = { purchaseId: "11111111-1111-4111-8111-111111111111", reason: "other", explanation: "A valid explanation for this fixture." };
function reply() { const r: any = { code: 200, body: null, setHeader: vi.fn(), status(n: number) { r.code=n; return r; }, json(data: unknown) { r.body=data; return r; } }; return r; }
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ id: "verified-owner", email: "fixture@example.invalid" }); });
describe("refund error authenticity", () => {
  it.each([404,409,422])("does not relabel an unbranded infrastructure %s as a refund decision", async statusCode => { mocks.create.mockRejectedValue(Object.assign(new Error("PRIVATE_PROVIDER_DETAIL"), { statusCode, code: "refund_window_closed" })); const r=reply(); await handler({method:"POST",body,headers:{}} as any,r); expect(r.code).toBe(500); expect(r.body).toEqual({error:{code:"refund_request_failed",message:"Refund request could not be submitted."}}); });
  it("keeps validation error text fixed", async () => { const r=reply(); await handler({method:"POST",body:{...body,purchaseId:"PRIVATE_BAD_INPUT"},headers:{}} as any,r); expect(r.code).toBe(400); expect(r.body).toEqual({error:{code:"validation_error",message:"Invalid refund request."}}); expect(mocks.create).not.toHaveBeenCalled(); });
});

const brandedCodes = [["purchase_not_found",404],["refund_window_closed",422],["refund_request_exists",409]] as const;
describe("branded refund decisions",()=>{
  it.each(brandedCodes)("preserves genuine %s without forwarding a mutated message",async(code,status)=>{const error=new DraftProRefundError(code);error.message="PRIVATE_OVERRIDDEN_MESSAGE";mocks.create.mockRejectedValue(error);const r=reply();await handler({method:"POST",body,headers:{}} as any,r);expect(r.code).toBe(status);expect(r.body.error.code).toBe(code);expect(JSON.stringify(r.body)).not.toContain("PRIVATE");});
  it("preserves the sign-in boundary and never calls the service for denial",async()=>{mocks.auth.mockImplementation(async(_req,res)=>{res.status(401).json({error:{code:"authentication_required"}});return null;});const r=reply();await handler({method:"POST",body,headers:{}} as any,r);expect(r.code).toBe(401);expect(mocks.create).not.toHaveBeenCalled();});
});

it("rejects an invalid branded prototype without throwing from the error handler",async()=>{const error=Object.assign(Object.create(DraftProRefundError.prototype),{code:"__proto__"});mocks.create.mockRejectedValue(error);const r=reply();await handler({method:"POST",body,headers:{}} as any,r);expect(r.code).toBe(500);expect(r.body.error.code).toBe("refund_request_failed");});
