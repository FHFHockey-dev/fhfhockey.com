select 'served_ledger' t, string_agg(column_name,' ') from information_schema.columns where table_name='forge_served_forecast_ledger'
