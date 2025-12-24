-- Projection engine run metadata (v2)
-- Stores orchestration status and run-level metrics for idempotent serving/debugging.

CREATE TABLE IF NOT EXISTS projection_runs_v2 (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    as_of_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    git_sha TEXT NULL,
    notes TEXT NULL,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT projection_runs_v2_status_check CHECK (
        status IN ('created', 'running', 'succeeded', 'failed')
    )
);

CREATE INDEX IF NOT EXISTS idx_projection_runs_v2_as_of_date
ON projection_runs_v2 (as_of_date);

CREATE INDEX IF NOT EXISTS idx_projection_runs_v2_status
ON projection_runs_v2 (status);

