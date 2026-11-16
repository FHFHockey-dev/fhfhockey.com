select string_agg(column_name,' ') from information_schema.columns where table_name='player_forecast_source_observations'
