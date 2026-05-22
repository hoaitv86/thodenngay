import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kckjmycpdnynbeicedsu.supabase.co';
const supabaseKey = 'sb_publishable_VKGg-HTt6OznFVRj1KEOXA_4ZZ8TyBy';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Logging in as worker...");
  let email = 'worker@alotho.local';
  let password = '123456';

  let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.log("Could not login as worker@alotho.local. Trying worker@alotho.vn...");
    email = 'worker@alotho.vn';
    const res = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    authData = res.data;
    authError = res.error;
  }

  if (authError) {
    console.error("Login failed:", authError.message);
    process.exit(1);
  }

  const user = authData.user;
  console.log(`Logged in successfully! User ID: ${user.id}, Email: ${user.email}`);

  // Fetch worker profile
  const { data: workerData, error: workerErr } = await supabase
    .from('workers')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (workerErr) {
    console.error("Error fetching worker profile:", workerErr.message);
    process.exit(1);
  }

  console.log(`Worker profile found: ID = ${workerData.id}, Status = ${workerData.status}`);

  // Fetch history jobs
  console.log("Fetching history jobs...");
  const { data: jobs, error: jobsErr } = await supabase
    .from('jobs')
    .select('*, service:services(*), customer:profiles!customer_id(*)')
    .eq('worker_id', workerData.id)
    .in('status', ['completed', 'done', 'cancelled'])
    .order('updated_at', { ascending: false });

  if (jobsErr) {
    console.error("Error fetching history jobs:", jobsErr.message);
  } else {
    console.log(`Successfully fetched ${jobs?.length || 0} history jobs.`);
    if (jobs) {
      jobs.forEach(j => {
        console.log(`- ID: ${j.id}, Code: ${j.job_code}, Status: ${j.status}, Service: ${j.service?.name}, Customer: ${JSON.stringify(j.customer)}`);
      });
    }
  }

  // Fetch all jobs for this worker to see what statuses they have
  console.log("Fetching all jobs for this worker...");
  const { data: allJobs, error: allJobsErr } = await supabase
    .from('jobs')
    .select('*, service:services(*)')
    .eq('worker_id', workerData.id);

  if (allJobsErr) {
    console.error("Error fetching all jobs:", allJobsErr.message);
  } else {
    console.log(`Successfully fetched ${allJobs?.length || 0} total jobs.`);
    if (allJobs) {
      allJobs.forEach(j => {
        console.log(`- ID: ${j.id}, Code: ${j.job_code}, Status: ${j.status}, Service: ${j.service?.name}`);
      });
    }
  }

  process.exit(0);
}

test();
