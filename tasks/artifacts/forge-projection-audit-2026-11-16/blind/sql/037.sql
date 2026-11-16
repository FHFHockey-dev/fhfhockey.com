select run_id, as_of_date, status, git_sha, created_at, metrics->'execution_scope' sc, metrics->>'games' g, notes from forge_runs where run_id='328a982a-247f-440f-b230-08882e50fcfa'
