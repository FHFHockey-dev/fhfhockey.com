select 'game_revisions' t, count(*) n, max(published_at)::text last from forge_game_revisions where slate_date >= '2026-11-01'
