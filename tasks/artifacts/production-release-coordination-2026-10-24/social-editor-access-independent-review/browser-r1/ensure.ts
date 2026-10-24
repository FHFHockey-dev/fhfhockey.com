import { fixture } from './auth';
export async function ensureUserRecords(user:{id:string}) { fixture.ensureCalls.push(user.id); }
