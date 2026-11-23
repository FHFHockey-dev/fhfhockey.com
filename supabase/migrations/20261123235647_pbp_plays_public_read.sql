-- Social-share goalie posts prove a game final from its pbp_plays game-end row through the public (anon) client.
-- RLS was on with no policy, so anon read zero rows. Read-only: anon/authenticated writes stay blocked (no write policy).
create policy public_read on public.pbp_plays for select to anon, authenticated using (true);
