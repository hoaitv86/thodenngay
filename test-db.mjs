import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kckjmycpdnynbeicedsu.supabase.co';
const supabaseKey = 'sb_publishable_VKGg-HTt6OznFVRj1KEOXA_4ZZ8TyBy';

async function test() {
  console.log("Starting DB test...");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/jobs?select=*`, {
      signal: controller.signal,
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    clearTimeout(timeoutId);
    console.log("HTTP Response status:", res.status);
    const data = await res.json();
    console.log("Jobs found:", data.length);
    if (data.length > 0) {
      data.slice(0, 5).forEach(j => {
        console.log(`- Job Code: ${j.job_code}, Status: ${j.status}, Worker ID: ${j.worker_id}, Images: ${JSON.stringify(j.images)}`);
      });
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("Fetch failed:", err.name === 'AbortError' ? 'Timeout' : err.message);
  }
  process.exit(0);
}

test();
