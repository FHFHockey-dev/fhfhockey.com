import type { User as SupabaseUser } from "@supabase/supabase-js";

import supabase from "lib/supabase/client";

function resolveDisplayName(user: SupabaseUser) {
  const metadata = user.user_metadata ?? {};
  return (
    metadata["preferred_username"] ||
    metadata["full_name"] ||
    metadata["name"] ||
    user.email ||
    user.id
  );
}

function resolveAvatarUrl(user: SupabaseUser) {
  const metadata = user.user_metadata ?? {};
  return metadata["avatar_url"] || metadata["picture"] || null;
}

function resolveTimezone() {
  if (typeof Intl === "undefined") return null;
  return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
}

function isDuplicateInsertError(error: { code?: string } | null) {
  return error?.code === "23505";
}

export async function ensureUserRecords(user: SupabaseUser) {
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("user_id, display_name, avatar_url, timezone")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("user_settings").select("user_id").eq("user_id", user.id).maybeSingle()
  ]);

  if (!profile) {
    const { error } = await supabase.from("user_profiles").insert({
      user_id: user.id,
      display_name: resolveDisplayName(user),
      avatar_url: resolveAvatarUrl(user),
      timezone: resolveTimezone()
    });

    if (error && !isDuplicateInsertError(error)) {
      throw error;
    }
  } else {
    const profilePatch: {
      display_name?: string;
      avatar_url?: string;
      timezone?: string;
    } = {};

    if (!profile.display_name) {
      profilePatch.display_name = resolveDisplayName(user);
    }
    if (!profile.avatar_url) {
      const avatarUrl = resolveAvatarUrl(user);
      if (avatarUrl) profilePatch.avatar_url = avatarUrl;
    }
    if (!profile.timezone) {
      const timezone = resolveTimezone();
      if (timezone) profilePatch.timezone = timezone;
    }

    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabase
        .from("user_profiles")
        .update(profilePatch)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }
    }
  }

  if (!settings) {
    const { error } = await supabase.from("user_settings").insert({
      user_id: user.id
    });

    if (error && !isDuplicateInsertError(error)) {
      throw error;
    }
  }
}
