select string_agg(column_name,' ') cols from information_schema.columns where table_name='forge_projection_accuracy_daily'
