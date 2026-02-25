import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Use a timestamp just before the demo started to safely delete only the demo data.
const demoStartTime = "2026-02-25T05:14:00.000Z";

async function clean() {
    console.log("Cleaning test transactions...");
    const { error: tErr } = await supabase.from('transactions').delete().gte('created_at', demoStartTime);
    if (tErr) console.error("transactions error:", tErr);
    else console.log("Transactions clean ok.");

    console.log("Cleaning test categories...");
    const { error: cErr } = await supabase.from('categories').delete().gte('created_at', demoStartTime);
    if (cErr) console.error("categories error:", cErr);
    else console.log("Categories clean ok.");

    console.log("Cleaning test fixed_costs...");
    const { error: fErr } = await supabase.from('fixed_costs').delete().gte('created_at', demoStartTime);
    if (fErr) console.error("fixed_costs error:", fErr);
    else console.log("Fixed costs clean ok.");
}

clean();
