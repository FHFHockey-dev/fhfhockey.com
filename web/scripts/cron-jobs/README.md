# xFS Cron Job Infrastructure Documentation

## Overview

The xFS (Expected Fantasy Score) prediction system uses two daily cron jobs to generate predictions and track their accuracy:

1. **Daily Prediction Generation** (6:00 AM UTC)
2. **Daily Audit Log Updates** (7:00 AM UTC)

## Setup Instructions

### 1. Deploy API Endpoints

The following API endpoints must be deployed and accessible:

- `/api/v1/db/generate-xfs-predictions` - Generates daily xFS predictions
- `/api/v1/db/update-xfs-audit-logs` - Updates audit logs with actual performance data

### 2. Execute Cron Job SQL

Run the following SQL files in your Supabase SQL editor to schedule the cron jobs:

```sql
-- Execute this first:
\i scripts/cron-jobs/daily-xfs-predictions.sql

-- Then execute this:
\i scripts/cron-jobs/update-xfs-audit-logs.sql
```

### 3. Verify Job Scheduling

After executing the SQL files, verify the jobs are scheduled:

```sql
-- Check if jobs are scheduled
SELECT * FROM cron.job WHERE jobname IN ('generate-daily-xfs-predictions', 'update-xfs-audit-logs');

-- Should return 2 rows with job details
```

## Job Details

### Daily Prediction Generation Job

- **Schedule**: 6:00 AM UTC daily
- **Timeout**: 10 minutes
- **Function**: Generates 5-game and 10-game xFS predictions for all active players
- **Batch Size**: 50 players per batch
- **Output**: Creates prediction records and audit log entries

### Daily Audit Update Job

- **Schedule**: 7:00 AM UTC daily (1 hour after prediction generation)
- **Timeout**: 5 minutes
- **Function**: Updates audit log entries with actual performance data
- **Batch Size**: 25 entries per batch
- **Output**: Calculates accuracy scores for completed predictions

## Monitoring and Troubleshooting

### Check Job Status

```sql
-- View job details
SELECT jobname, schedule, active, jobid 
FROM cron.job 
WHERE jobname LIKE '%xfs%';

-- View recent job runs
SELECT j.jobname, jr.start_time, jr.end_time, jr.status, jr.return_message
FROM cron.job_run_details jr
JOIN cron.job j ON jr.jobid = j.jobid
WHERE j.jobname LIKE '%xfs%'
ORDER BY jr.start_time DESC
LIMIT 20;
```

### Check API Endpoint Logs

Monitor the API endpoint responses for:
- Total predictions generated
- Error counts
- Processing duration
- Batch processing status

### Common Issues and Solutions

1. **Job Not Running**
   - Check if job is active: `SELECT * FROM cron.job WHERE jobname = 'generate-daily-xfs-predictions'`
   - Verify network connectivity from Supabase to your domain

2. **Timeout Errors**
   - Increase timeout in the cron job SQL
   - Optimize batch processing in the API endpoints

3. **Authentication Errors**
   - Verify the bearer token matches in both cron job and API endpoint
   - Check API endpoint authorization header validation

4. **No Data Generated**
   - Verify players exist in `wgo_skater_stats_totals` for current season
   - Check minimum games played filter (currently 10 games)

## Performance Optimization

### Database Optimization

- Ensure indexes exist on xFS prediction tables (created in migration)
- Monitor query performance for player data retrieval
- Consider adjusting batch sizes based on performance

### API Optimization

- Implement connection pooling for database connections
- Add caching for frequently accessed player data
- Monitor memory usage during batch processing

## Security Considerations

- The cron jobs use a shared authentication token
- API endpoints validate the bearer token before processing
- All database operations use parameterized queries
- Batch processing limits prevent overwhelming the database

## Manual Job Execution

For testing or manual execution:

```bash
# Test prediction generation
curl -X POST https://fhfhockey.com/api/v1/db/generate-xfs-predictions \
  -H "Authorization: Bearer fhfh-cron-mima-233" \
  -H "Content-Type: application/json"

# Test audit log updates
curl -X POST https://fhfhockey.com/api/v1/db/update-xfs-audit-logs \
  -H "Authorization: Bearer fhfh-cron-mima-233" \
  -H "Content-Type: application/json"
```

## Unscheduling Jobs

If you need to stop the cron jobs:

```sql
-- Unschedule prediction generation
SELECT cron.unschedule('generate-daily-xfs-predictions');

-- Unschedule audit updates
SELECT cron.unschedule('update-xfs-audit-logs');
```

## Data Retention

- Prediction data is stored permanently for historical analysis
- Audit log entries track prediction accuracy over time
- Consider implementing data archiving for old predictions if storage becomes an issue

## Future Enhancements

- Add email notifications for job failures
- Implement more sophisticated xFS calculation algorithms
- Add real-time prediction updates based on lineup changes
- Create dashboard for monitoring prediction accuracy trends