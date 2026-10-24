type Session = {user:{id:string;email:string;user_metadata:object;app_metadata:object};access_token:string}|null;
let current: Session = null;
const listeners = new Set<(event:string,session:Session)=>unknown>();
const roles = new Map<string,unknown>();
const pendingRoles = new Map<string,{promise:Promise<any>;resolve:(result:any)=>void}>();
export const fixture = {
  ensureCalls: [] as string[],
  session() { return current; },
  async setSession(id:string|null,role:unknown=null,token='synthetic-'+id) {
    current=id ? {user:{id,email:id+'@example.invalid',user_metadata:{},app_metadata:{}},access_token:token}:null;
    if(id)roles.set(id,role);
    await Promise.all([...listeners].map(fn=>fn(current?'TOKEN_REFRESHED':'SIGNED_OUT',current)));
  },
  deferRole(id:string) { let resolve!:(result:any)=>void; const promise=new Promise(res=>resolve=res);pendingRoles.set(id,{promise,resolve}); },
  resolveRole(id:string,role:unknown,error:unknown=null) { const pending=pendingRoles.get(id);pendingRoles.delete(id);pending?.resolve({data:{role},error}); },
};
export default {
  auth: {
    getSession: async()=>({data:{session:current},error:null}),
    onAuthStateChange(fn:(event:string,session:Session)=>unknown){listeners.add(fn);return {data:{subscription:{unsubscribe(){listeners.delete(fn);}}}};},
    async signOut(){await fixture.setSession(null);return {error:null};},
  },
  from(table:string){return {select(){return {eq(_key:string,id:string){return {maybeSingle(){return table==='users' ? pendingRoles.get(id)?.promise??Promise.resolve({data:{role:roles.get(id)??null},error:null}) : Promise.resolve({data:null,error:null});}};}};}};},
};
