// @ts-nocheck
// Dipanggil oleh Database Webhook (INSERT pada public.matches).
// Wajib: secret WEBHOOK_SECRET dan header "x-webhook-secret" pada webhook.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]\s]+\]$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!webhookSecret || !supabaseUrl || !serviceKey) {
    return json({ error: 'server_misconfigured' }, 500);
  }

  const provided = req.headers.get('x-webhook-secret') ?? '';
  if (!(await secretsMatch(provided, webhookSecret))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const rest = (path: string, init: RequestInit = {}) =>
    fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

  let claimedKey: string | null = null;
  try {
    const payload = await req.json().catch(() => null);
    if (!payload || payload.type !== 'INSERT') return json({ skipped: 'not_insert' });

    const matchId = payload.record?.id;
    if (typeof matchId !== 'string' || !UUID_RE.test(matchId)) {
      return json({ error: 'invalid_record' }, 400);
    }

    // Data dibaca ulang dari database; isi payload tidak dipercaya.
    const matchRes = await rest(`matches?id=eq.${matchId}&select=id,user_a_id,user_b_id`);
    const [match] = matchRes.ok ? await matchRes.json() : [];
    if (!match) return json({ skipped: 'match_not_found' });

    const profRes = await rest(
      `profiles?id=in.(${match.user_a_id},${match.user_b_id})&select=id,nama,push_token`,
    );
    const profiles = profRes.ok ? await profRes.json() : [];
    const userA = profiles.find((p: any) => p.id === match.user_a_id);
    const userB = profiles.find((p: any) => p.id === match.user_b_id);

    const messages: any[] = [];
    if (userA?.push_token && EXPO_TOKEN_RE.test(userA.push_token)) {
      messages.push({
        to: userA.push_token,
        title: "It's a Match! 🔥",
        body: `You and ${userB?.nama || 'a sports partner'} both want to play!`,
        data: { type: 'match', matchId },
      });
    }
    if (userB?.push_token && EXPO_TOKEN_RE.test(userB.push_token)) {
      messages.push({
        to: userB.push_token,
        title: "It's a Match! 🔥",
        body: `You and ${userA?.nama || 'a sports partner'} both want to play!`,
        data: { type: 'match', matchId },
      });
    }
    if (messages.length === 0) return json({ skipped: 'no_push_token' });

    // Klaim kunci dedupe tepat sebelum kirim; baris sudah ada = push sudah pernah dikirim.
    const dedupeKey = `match:${matchId}`;
    const claimRes = await rest('push_dedupe', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ dedupe_key: dedupeKey }),
    });
    if (!claimRes.ok) return json({ error: 'dedupe_failed' }, 500);
    const claimed = await claimRes.json();
    if (claimed.length === 0) return json({ skipped: 'duplicate' });
    claimedKey = dedupeKey;

    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!pushRes.ok) {
      await rest(`push_dedupe?dedupe_key=eq.${encodeURIComponent(dedupeKey)}`, { method: 'DELETE' });
      claimedKey = null;
      return json({ error: 'push_failed' }, 502);
    }

    return json({ success: true, count: messages.length });
  } catch (err: any) {
    if (claimedKey) {
      await rest(`push_dedupe?dedupe_key=eq.${encodeURIComponent(claimedKey)}`, { method: 'DELETE' }).catch(() => {});
    }
    console.error('notify-match error:', err?.message);
    return json({ error: 'internal_error' }, 500);
  }
});
