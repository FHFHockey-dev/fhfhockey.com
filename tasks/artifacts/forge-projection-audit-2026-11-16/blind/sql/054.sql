select string_agg(column_name,' ') from information_schema.columns where table_name='rosters'
