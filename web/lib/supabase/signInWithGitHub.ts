import supabase from ".";

export default async function signInWithGitHub() {
  const data = await supabase.auth.signIn(
    {
      provider: "github",
    },
    { redirectTo: window.location.href }
  );
  return data;
}
