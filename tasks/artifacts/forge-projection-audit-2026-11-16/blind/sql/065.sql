select count(*) total, count(*) filter (where created_at > now() - interval '30 days') last30, max(created_at) last, count(distinct event_type) types from forge_roster_events
