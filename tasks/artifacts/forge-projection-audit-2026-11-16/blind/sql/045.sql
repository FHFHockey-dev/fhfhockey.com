select "seasonId", count(*) n, count(*) filter (where is_current) cur from rosters where "seasonId" >= 20252026 group by 1
