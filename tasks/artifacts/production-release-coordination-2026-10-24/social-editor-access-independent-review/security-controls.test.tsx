import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
const mock = vi.hoisted(() => ({ getSession: vi.fn(), listen: vi.fn(), signOut: vi.fn(), role: vi.fn(), profile: vi.fn(), getUser: vi.fn(), serverRole: vi.fn(), source: vi.fn(), ensure: vi.fn() }));
vi.mock('lib/supabase/client', () => ({ default: {
  auth: { getSession: mock.getSession, onAuthStateChange: mock.listen, signOut: mock.signOut },
  from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: table === 'users' ? mock.role : mock.profile }) }) }),
} }));
vi.mock('lib/user-settings/ensureUserRecords', () => ({ ensureUserRecords: mock.ensure }));
vi.mock('lib/supabase', () => ({ createClientWithToken: () => ({ auth: { getUser: mock.getUser }, from: () => ({ select: () => ({ eq: (_key: string, id: string) => { expect(id).toBe('verified-fixture'); return { maybeSingle: mock.serverRole }; } }) }) }) }));
vi.mock('lib/socialShare/server', () => ({ loadScheduleShareSnapshot: mock.source, SocialShareRequestError: class extends Error { status = 400; } }));
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));
import AuthProvider, { useAuth } from './snapshot/web/contexts/AuthProviderContext';
import Gate from './snapshot/web/components/SocialShare/SocialShareAccessGate';
import { fetchEdition } from './snapshot/web/lib/socialShare/editionFetch';
import handler from './snapshot/web/pages/api/v1/social-share/[format]';

const session = (id = 'A', token = 'token-A') => ({ user: { id, email: id+'@example.invalid', user_metadata: {}, app_metadata: {} }, access_token: token });
const authReply = (value: any) => ({ data: { session: value }, error: null });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: any) => void; const promise = new Promise<T>((res, rej) => { resolve=res; reject=rej; }); return { promise, resolve, reject }; }
const url = '/api/v1/social-share/game-grid?weekStart=2026-10-26';
const reply = (body: any) => ({ ok: true, status: 200, json: async () => body }) as Response;
function Probe() { const auth = useAuth(); return <><output data-testid="user">{auth.user?.id ?? 'none'}</output><output data-testid="role">{auth.user?.role ?? 'none'}</output><button onClick={() => void auth.signOut()}>Sign out</button></>; }
let mounts = 0;
function Workspace() { useEffect(() => { mounts++; }, []); return <p>Protected fixture workspace</p>; }
function provider() { return render(<AuthProvider><Probe /><Gate><Workspace /></Gate></AuthProvider>); }
function authEvent(value: any) { return act(async () => { await mock.listen.mock.calls[0][0]('TOKEN_REFRESHED',value); }); }
async function request(overrides: any = {}) { const res = { code: 0, body: null as any, headers: {} as Record<string,string>, setHeader(k:string,v:string){this.headers[k]=v;}, status(n:number){this.code=n;return this;}, json(body:any){this.body=body;return this;} }; await handler({ method:'GET', query:{format:'game-grid'},headers:{authorization:'Bearer fixture-token'},...overrides } as any,res as any); expect(res.headers['Cache-Control']).toBe('private, no-store, max-age=0'); expect(res.headers.Vary).toBe('Authorization'); return res; }
beforeEach(() => {
  vi.clearAllMocks(); mounts=0;
  mock.getSession.mockReset().mockResolvedValue(authReply(session()));
  mock.listen.mockReturnValue({data:{subscription:{unsubscribe:vi.fn()}}});
  mock.signOut.mockReset().mockResolvedValue({error:null});
  mock.role.mockReset().mockResolvedValue({data:{role:'social_editor'},error:null});
  mock.profile.mockResolvedValue({data:null,error:null});
  mock.ensure.mockResolvedValue(undefined);
  mock.getUser.mockReset().mockResolvedValue({data:{user:{id:'verified-fixture',user_metadata:{role:'admin'}}},error:null});
  mock.serverRole.mockReset().mockResolvedValue({data:{role:'social_editor'},error:null});
  mock.source.mockReset().mockResolvedValue({state:'ready',fixture:'protected'});
});
afterEach(() => cleanup());

describe('independent direct API boundary', () => {
  it.each([{}, {authorization:'Bearer fake, Bearer fixture-token'}, {authorization:['Bearer fixture-token']}, {authorization:'Basic fixture-token'}])('denies credentials %j without edition reads', async headers => { const result=await request({headers}); expect(result.code).toBe(401); expect(mock.source).not.toHaveBeenCalled(); expect(mock.getUser).not.toHaveBeenCalled(); });
  it('rejects duplicate physical Authorization headers', async () => { expect((await request({rawHeaders:['authorization','Bearer fixture-token','Authorization','Bearer other']})).code).toBe(401); expect(mock.getUser).not.toHaveBeenCalled(); });
  it.each([null,'social-editor','ADMIN','social_editor ',['social_editor']])('denies unapproved role %j despite metadata',async role => {mock.serverRole.mockResolvedValueOnce({data:{role},error:null});expect((await request()).code).toBe(403);expect(mock.source).not.toHaveBeenCalled();});
  it('requires successful verified-user response, not metadata or a token-shaped string', async()=>{mock.getUser.mockResolvedValueOnce({data:{user:{id:'forged'}},error:{message:'private sentinel'}});expect((await request()).code).toBe(401);expect(mock.serverRole).not.toHaveBeenCalled();});
  it.each(['auth','role','source'])('keeps %s exceptions private and no-store',async where=>{({auth:mock.getUser,role:mock.serverRole,source:mock.source})[where].mockRejectedValueOnce(new Error('private sentinel'));const r=await request();expect(r.code).toBe(503);expect(JSON.stringify(r.body)).not.toContain('private sentinel');});
  it('denies duplicate-row role errors even with an allowed data payload',async()=>{mock.serverRole.mockResolvedValueOnce({data:{role:'admin'},error:{code:'PGRST116'}});expect((await request()).code).toBe(503);expect(mock.source).not.toHaveBeenCalled();});
  it('rejects all unsupported methods, formats, and queries before protected reads',async()=>{for(const method of ['POST','PUT','PATCH','DELETE','HEAD','OPTIONS']){const r=await request({method});expect(r.code).toBe(405);expect(r.headers.Allow).toBe('GET');} for(const format of ['publish','admin',['game-grid'],'Game-grid'])expect((await request({query:{format}})).code).toBe(404);for(const query of [{format:'game-grid',weekStart:['2026-10-26']},{format:'game-grid',selectedDates:['2026-10-26']},{format:'game-grid',action:'export'}])expect((await request({query})).code).toBe(400);expect(mock.source).not.toHaveBeenCalled();expect(mock.getUser).not.toHaveBeenCalled();});
  it.each(['game-grid','remaining-week','tuesday-trends','player-spotlight','category-rescue'])('supports existing exact GET format %s',async format=>{expect((await request({query:{format}})).code).toBe(200);expect(mock.getUser).toHaveBeenCalledWith('fixture-token');});
});

describe('independent AuthProvider and gate races',()=>{
  it('never mounts while initial role is pending and discards a late grant after account switch',async()=>{const old=deferred<any>();mock.role.mockReturnValueOnce(old.promise).mockResolvedValueOnce({data:{role:null},error:null});provider();await waitFor(()=>expect(mock.role).toHaveBeenCalledTimes(1));expect(mounts).toBe(0);await authEvent(session('B','token-B'));await waitFor(()=>expect(screen.getByTestId('user').textContent).toBe('B'));await act(async()=>old.resolve({data:{role:'social_editor'},error:null}));expect(screen.getByTestId('role').textContent).toBe('none');expect(mounts).toBe(0);});
  it('discarded old-account rejection cannot erase a newer account grant',async()=>{const old=deferred<any>();mock.role.mockReturnValueOnce(old.promise);provider();await waitFor(()=>expect(mock.role).toHaveBeenCalledTimes(1));await authEvent(session('B','token-B'));await screen.findByText('Protected fixture workspace');await act(async()=>old.reject(new Error('offline')));expect(screen.getByTestId('role').textContent).toBe('social_editor');});
  it.each(['return','reject'])('token revalidation closes workspace and clears role on %s failure',async mode=>{provider();await screen.findByText('Protected fixture workspace');const pending=deferred<any>();mock.role.mockReturnValueOnce(pending.promise);await authEvent(session('A','token-A2'));expect(screen.queryByText('Protected fixture workspace')).toBeNull();await act(async()=>{if(mode==='return')pending.resolve({data:{role:'social_editor'},error:new Error('unavailable')});else pending.reject(new Error('unavailable'));});await waitFor(()=>expect(screen.getByTestId('role').textContent).toBe('none'));expect(screen.queryByText('Protected fixture workspace')).toBeNull();});
  it('sign-out closes workspace synchronously while local sign-out is still pending',async()=>{mock.signOut.mockReturnValue(new Promise(()=>{}));provider();await screen.findByText('Protected fixture workspace');fireEvent.click(screen.getByRole('button',{name:'Sign out'}));expect(screen.getByTestId('user').textContent).toBe('none');expect(screen.queryByText('Protected fixture workspace')).toBeNull();expect(mock.signOut).toHaveBeenCalledWith({scope:'local'});});
  it('ignores delayed initial session after explicit sign-out',async()=>{const initial=deferred<any>();mock.getSession.mockReturnValueOnce(initial.promise);provider();fireEvent.click(screen.getByRole('button',{name:'Sign out'}));await act(async()=>initial.resolve(authReply(session())));expect(screen.getByTestId('user').textContent).toBe('none');expect(mock.role).not.toHaveBeenCalled();expect(mounts).toBe(0);});
});

describe('independent bearer fetch and session partitioning',()=>{
  it.each(['https://other.invalid/api/v1/social-share/game-grid','//other.invalid/api/v1/social-share/game-grid','/api/v1/social-share/game-grid/../publish','/api/v1/social-share/game-grid#x','/api/v1/social-share/game-grid?x=\\evil'])('does not send a bearer outside the allowlist %s',async target=>{const send=vi.fn();await expect(fetchEdition(target,send)).rejects.toThrow('Invalid');expect(send).not.toHaveBeenCalled();expect(mock.getSession).not.toHaveBeenCalled();});
  it('same URL work is partitioned by account and discards old-account data',async()=>{const old=deferred<Response>();const sendA=vi.fn(()=>old.promise);const a=fetchEdition(url,sendA as any);const denied=expect(a).rejects.toThrow('session changed');await waitFor(()=>expect(sendA).toHaveBeenCalledTimes(1));mock.getSession.mockResolvedValue(authReply(session('B','token-B')));const sendB=vi.fn(async()=>reply({owner:'B'}));expect((await fetchEdition(url,sendB)).body.owner).toBe('B');expect(sendB.mock.calls[0][1].headers.Authorization).toBe('Bearer token-B');old.resolve(reply({owner:'A'}));await denied;});
  it('rejects sign-out during delayed body decoding',async()=>{const body=deferred<any>();const pending=fetchEdition(url,vi.fn(async()=>({ok:true,status:200,json:()=>body.promise})) as any);const denied=expect(pending).rejects.toThrow('session changed');await Promise.resolve();mock.getSession.mockResolvedValue(authReply(null));body.resolve({private:'old'});await denied;});
  it('token refresh partitions pending work for the same account',async()=>{const old=deferred<Response>();const sendA=vi.fn(()=>old.promise);const a=fetchEdition(url,sendA as any);const denied=expect(a).rejects.toThrow('session changed');await waitFor(()=>expect(sendA).toHaveBeenCalledTimes(1));mock.getSession.mockResolvedValue(authReply(session('A','token-A2')));expect((await fetchEdition(url,vi.fn(async()=>reply({edition:'fresh'})) as any)).body.edition).toBe('fresh');old.resolve(reply({edition:'old'}));await denied;});
});
