select jobid, schedule, active, left(regexp_replace(command,'\s+',' ','g'),140) cmd from cron.job order by jobid
