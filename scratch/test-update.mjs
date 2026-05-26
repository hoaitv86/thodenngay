const supabaseUrl = 'https://kckjmycpdnynbeicedsu.supabase.co';
const supabaseKey = 'sb_publishable_VKGg-HTt6OznFVRj1KEOXA_4ZZ8TyBy';

async function testFetch() {
  console.log("Fetching profiles via REST...");
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/profiles?select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Data length:", data.length);
    console.log("First 3 items:", data.slice(0, 3));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

testFetch();
