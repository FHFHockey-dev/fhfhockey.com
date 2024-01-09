import supabase from ".";

export default async function signInWithGitHub() {
  const data = await supabase.auth.signInWithOAuth({
    provider: "github",
  });
  return data;
}
