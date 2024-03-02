import { IncomingMessage } from "http";
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import type { Database } from "./database-generated.types";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fyhftlxokyjtpndbkfse.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY || "";
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

export function createClientWithToken(access_token: string): typeof supabase;
export function createClientWithToken(req: IncomingMessage): typeof supabase;
export function createClientWithToken(...args: any) {
  let access_token = "";
  if (typeof args[0] === "string") {
    access_token = args[0];
  } else if (args[0] instanceof IncomingMessage) {
    const req = args[0] as IncomingMessage;
    access_token = req.headers["authorization"]?.split(" ")[1] ?? "";
  }

  const client = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    },
  });

  return client;
}

/**
 * Make a post request with supabase access token in Authorization header.
 * @param url
 * @param body
 * @returns
 */
export async function doPOST(url: string, body?: any) {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw new Error("Failed to authenticate.");

  console.log("send post request to", url);
  const result = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  }).then((res) => res.json());

  return result;
}

export async function getRole(client: SupabaseClient) {
  const { data } = await client.from("users").select("role").single();
  return data?.role ?? "";
}

export default supabase;
