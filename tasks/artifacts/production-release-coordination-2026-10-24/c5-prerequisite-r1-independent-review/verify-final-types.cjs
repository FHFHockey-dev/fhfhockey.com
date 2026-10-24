// Final static pin/type-erasure comparison; no application module execution.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..');const ts=require(path.join(repo,'web/node_modules/typescript'));
const packet=path.join(repo,'tasks/artifacts/production-release-coordination-2026-10-24/c5-prerequisite-r1');const manifest=JSON.parse(fs.readFileSync(path.join(packet,'CANDIDATE.json'),'utf8'));
const initial=JSON.parse(fs.readFileSync(path.join(__dirname,'SOURCE-COMPARISON.json'),'utf8'));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const file='web/pages/api/v1/db/update-line-combinations/index.ts';const final=fs.readFileSync(path.join(manifest.snapshot,file),'utf8');
const head=cp.execFileSync('git',['show','2a5092d37cb863ec92a2a4e609999cf226bfa4a5:'+file],{cwd:repo,encoding:'utf8'});
const typeImports=['import type { NextApiRequest, NextApiResponse } from "next";','import type { Database } from "lib/supabase/database-generated.types";'];
const alias='type AuthorizedRequest = NextApiRequest & { supabase: SupabaseClient<Database> };';
const typed='async (req: AuthorizedRequest, res: NextApiResponse) => {';
let normalized=final;
for(const text of typeImports){if(!head.includes(text)||!normalized.includes(text))throw Error('Type import provenance');normalized=normalized.replace(text+'\n','');}
if(!head.includes(alias)||!head.includes(typed))throw Error('Type alias/parameter provenance');
normalized=normalized.replace('\n'+alias+'\n','').replace(typed,'async (req, res) => {');
if(hash(normalized)!==initial.selected[file].sha256)throw Error('Extra final change beyond exact erased type annotations');
const ast=ts.createSourceFile(file,final,ts.ScriptTarget.Latest,true);const bodies=[];const walk=node=>{if(ts.isFunctionLike(node)&&node.body)bodies.push(hash(node.body.getText(ast)));ts.forEachChild(node,walk);};walk(ast);
if(JSON.stringify(bodies)!==JSON.stringify(initial.route_comparisons.find(r=>r.path===file).function_body_sha256))throw Error('Final business body changed');
const selected={};const changed=[];
for(const[p,pin]of Object.entries(manifest.selected)){const actual=hash(fs.readFileSync(path.join(manifest.snapshot,p)));if(actual!==pin.sha256)throw Error(p+': pin mismatch');selected[p]={sha256:actual,matches_manifest:true};if(actual!==initial.selected[p].sha256)changed.push(p);}
if(changed.length!==1||changed[0]!==file)throw Error('Other initial source changed');
const result={manifest_sha256:hash(fs.readFileSync(path.join(packet,'CANDIDATE.json'))),candidate_patch_sha256:hash(fs.readFileSync(path.join(packet,'candidate.patch'))),selected_count:Object.keys(selected).length,selected,sole_changed_path_since_initial_proof:file,initial_sha256:initial.selected[file].sha256,final_sha256:hash(final),normalized_final_equals_initial:true,exact_HEAD_type_only_provenance:true,all_function_body_hashes_unchanged:true,all_other_87_paths_unchanged:true,static_source_only:true};
fs.writeFileSync(path.join(__dirname,'FINAL-SOURCE-COMPARISON.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({selected:result.selected_count,only_erased_typing_exception:file,all_function_bodies_unchanged:true,other_87_paths_unchanged:true,patch_sha256:result.candidate_patch_sha256}));
