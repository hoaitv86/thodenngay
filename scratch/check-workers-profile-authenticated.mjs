import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kckjmycpdnynbeicedsu.supabase.co';
const supabaseKey = 'sb_publishable_VKGg-HTt6OznFVRj1KEOXA_4ZZ8TyBy';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Logging in as worker...");
  let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'worker@alotho.local',
    password: '123456',
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    process.exit(1);
  }

  console.log("Logged in successfully! Fetching workers with profiles...");

  const { data: workers, error: workerErr } = await supabase
    .from('workers')
    .select('*, profiles:profiles(*)')
    .eq('status', 'active');

  if (workerErr) {
    console.error("Error fetching workers:", workerErr.message);
  } else {
    console.log("Workers fetched successfully:", workers.length);
    workers.forEach(w => {
      console.log(`- Worker ID: ${w.id}, Name: ${w.profiles?.full_name || 'NULL'}, Specialty: ${JSON.stringify(w.specialties)}, Rating: ${w.avg_rating}, Jobs: ${w.total_jobs}`);
    });
  }
}

test();
