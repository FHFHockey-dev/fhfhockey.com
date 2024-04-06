// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-2\web\lib\supabase\signInWithGitHub.ts

import supabase from ".";

export default async function signInWithGitHub() {
  const data = await supabase.auth.signInWithOAuth({
    provider: "github",
  });
  return data;
}
