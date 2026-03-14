const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './web/.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
    const { data, error } = await supabase.from('forge_projection_accuracy_daily').select('*').limit(5);
    console.log(data, error);
})();
