// Luvior Paris — contact form → Slack (+ saved copy in contact_messages).
// Secrets (Supabase → Edge Functions → Secrets): SLACK_WEBHOOK_URL
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

const ALLOWED_ORIGINS = [
  "https://luviorparis-del.github.io",
  "http://localhost:3457",
  "http://127.0.0.1:3457",
];

const REASONS: Record<string, string> = {
  order: "Order", shipping: "Shipping", return: "Return", product: "Product Question",
  wholesale: "Wholesale", press: "Press", collaboration: "Collaboration", other: "Other",
};

const LIMITS = { firstName: 80, lastName: 80, email: 200, phone: 40, orderNumber: 60, message: 5000 };
const MAX_PER_EMAIL_PER_HOUR = 5;

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}

// Slack mrkdwn: neutralise formatting/mentions coming from the public form.
const slackSafe = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400, origin); }

  // Honeypot: real visitors never fill this hidden field. Pretend success for bots.
  if (String(body.website ?? "").trim()) return json({ ok: true }, 200, origin);

  const f = Object.fromEntries(Object.keys(LIMITS).map((k) => [k, String(body[k] ?? "").trim()])) as Record<keyof typeof LIMITS, string>;
  const reasonKey = String(body.reason ?? "").trim();

  const problems: string[] = [];
  if (!f.firstName) problems.push("firstName");
  if (!f.lastName) problems.push("lastName");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) problems.push("email");
  if (!REASONS[reasonKey]) problems.push("reason");
  if (!f.message) problems.push("message");
  for (const [k, max] of Object.entries(LIMITS)) if (f[k as keyof typeof LIMITS].length > max) problems.push(k);
  if (problems.length) return json({ error: "Please check the highlighted fields.", fields: problems }, 400, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = (path: string, init: RequestInit = {}) => fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });

  // Rate limit per email (only if the table exists).
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await db(`contact_messages?select=id&email=eq.${encodeURIComponent(f.email.toLowerCase())}&created_at=gte.${encodeURIComponent(since)}`, { method: "GET" });
  if (recent.ok && (await recent.json()).length >= MAX_PER_EMAIL_PER_HOUR) {
    return json({ error: "Too many messages. Please try again later." }, 429, origin);
  }

  const record = {
    first_name: f.firstName, last_name: f.lastName, email: f.email.toLowerCase(), phone: f.phone || null,
    reason: reasonKey, order_number: f.orderNumber || null, message: f.message,
  };
  const saved = await db("contact_messages", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(record) });
  if (!saved.ok) console.error("contact_messages insert failed:", saved.status, await saved.text());

  const webhook = Deno.env.get("SLACK_WEBHOOK_URL");
  let slackOk = false;
  if (webhook) {
    const name = slackSafe(`${f.firstName} ${f.lastName}`);
    const fields = [
      `*From*\n${name}`,
      `*Email*\n<mailto:${encodeURIComponent(f.email)}|${slackSafe(f.email)}>`,
      `*Reason*\n${REASONS[reasonKey]}`,
      ...(f.phone ? [`*Phone*\n${slackSafe(f.phone)}`] : []),
      ...(f.orderNumber ? [`*Order*\n${slackSafe(f.orderNumber)}`] : []),
    ].map((text) => ({ type: "mrkdwn", text }));
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `New contact message from ${f.firstName} ${f.lastName} — ${REASONS[reasonKey]}`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: `New message — ${REASONS[reasonKey]}`, emoji: true } },
          { type: "section", fields },
          { type: "section", text: { type: "mrkdwn", text: `>${slackSafe(f.message).replace(/\n/g, "\n>")}` } },
          { type: "context", elements: [{ type: "mrkdwn", text: "Sent from the Luvior Paris contact form" }] },
        ],
      }),
    });
    slackOk = res.ok;
    if (!res.ok) console.error("Slack webhook failed:", res.status, await res.text());
  } else {
    console.error("SLACK_WEBHOOK_URL secret is not set");
  }

  if (!slackOk && !saved.ok) return json({ error: "We couldn't send your message right now. Please try again or email us." }, 502, origin);
  return json({ ok: true }, 200, origin);
});
