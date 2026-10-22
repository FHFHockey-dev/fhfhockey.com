import { expect,it,vi } from "vitest";
vi.mock("lib/supabase/server",()=>({default:{from:()=>{
 let rows=[{player_id:11,date:"2026-10-20",nst_shots_per_60:99,nst_ixg_per_60:9,nst_oi_xgf_per_60:99},{player_id:11,date:"2026-10-19",nst_shots_per_60:10,nst_ixg_per_60:1,nst_oi_xgf_per_60:2}];
 const q:any={select:()=>q,in:()=>q,lte:(c:string,v:string)=>{rows=rows.filter(r=>(r as any)[c]<=v);return q;},gte:(c:string,v:string)=>{rows=rows.filter(r=>(r as any)[c]>=v);return q;},order:()=>q,limit:()=>q,then:(resolve:any)=>resolve({data:rows,error:null})};return q;
}}}));
import { fetchLatestSkaterContextProfiles } from "./projections/queries/skater-queries";
it("reconstruction excludes the target game's observed per-game context",async()=>{
 const output=await fetchLatestSkaterContextProfiles([11],"2026-10-20");
 console.log("TARGET_DATE_CONTEXT_OBSERVED",JSON.stringify({shot:output.shotQuality.get(11),onIce:output.onIceContext.get(11)}));
 expect(output.shotQuality.get(11)?.sourceDate).toBe("2026-10-19");
});
