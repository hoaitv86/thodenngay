export default async function notificationDispatcher() {
  const baseUrl = process.env.NOTIFICATION_DISPATCH_BASE_URL || process.env.URL || process.env.DEPLOY_URL;
  const secret = process.env.NOTIFICATION_DISPATCH_SECRET;

  if (!baseUrl || !secret) {
    console.error("Missing NOTIFICATION_DISPATCH_BASE_URL/URL or NOTIFICATION_DISPATCH_SECRET");
    return new Response(null, { status: 500 });
  }

  const endpoint = new URL("/api/notifications/dispatch", baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ limit: 100 }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Notification dispatcher failed", response.status, body);
    return new Response(null, { status: 502 });
  }

  return new Response(null, { status: 204 });
}

export const config = {
  schedule: "* * * * *",
};
