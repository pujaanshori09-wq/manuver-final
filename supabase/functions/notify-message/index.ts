// @ts-nocheck
// Dipanggil oleh Database Webhook (INSERT pada public.messages).
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

    const messageId = payload.record?.id;
    if (typeof messageId !== 'string' || !UUID_RE.test(messageId)) {
      return json({ error: 'invalid_record' }, 400);
    }

    // Data dibaca ulang dari database; isi payload tidak dipercaya.
    const msgRes = await rest(`messages?id=eq.${messageId}&select=id,match_id,sender_id,content,type`);
    const [message] = msgRes.ok ? await msgRes.json() : [];
    if (!message) return json({ skipped: 'message_not_found' });

    const matchRes = await rest(`matches?id=eq.${message.match_id}&select=user_a_id,user_b_id`);
    const [match] = matchRes.ok ? await matchRes.json() : [];
    if (!match) return json({ skipped: 'match_not_found' });

    const senderId = message.sender_id;
    if (senderId !== match.user_a_id && senderId !== match.user_b_id) {
      return json({ skipped: 'sender_not_in_match' });
    }
    const recipientId = senderId === match.user_a_id ? match.user_b_id : match.user_a_id;

    const blockRes = await rest(
      `blocks?or=(and(blocker_id.eq.${senderId},blocked_id.eq.${recipientId}),and(blocker_id.eq.${recipientId},blocked_id.eq.${senderId}))&select=id&limit=1`,
    );
    const blocks = blockRes.ok ? await blockRes.json() : [];
    if (blocks.length > 0) return json({ skipped: 'blocked' });

    const profRes = await rest(`profiles?id=in.(${senderId},${recipientId})&select=id,nama,push_token`);
    const profiles = profRes.ok ? await profRes.json() : [];
    const sender = profiles.find((p: any) => p.id === senderId);
    const recipient = profiles.find((p: any) => p.id === recipientId);

    if (!recipient?.push_token || !EXPO_TOKEN_RE.test(recipient.push_token)) {
      return json({ skipped: 'no_push_token' });
    }

    // Klaim kunci dedupe tepat sebelum kirim; baris sudah ada = push sudah pernah dikirim.
    const dedupeKey = `message:${messageId}`;
    const claimRes = await rest('push_dedupe', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ dedupe_key: dedupeKey }),
    });
    if (!claimRes.ok) return json({ error: 'dedupe_failed' }, 500);
    const claimed = await claimRes.json();
    if (claimed.length === 0) return json({ skipped: 'duplicate' });
    claimedKey = dedupeKey;

    const name = sender?.nama || 'Teman Sparing';
    const content = String(message.content ?? '');
    const isInvite = message.type === 'sparing_invite' || content.startsWith('MVT_INVITE::');
    const pushMessage = {
      to: recipient.push_token,
      title: isInvite ? `🔥 ${name} Mengajak Sparing!` : `Pesan dari ${name}`,
      body: isInvite && content.startsWith('MVT_INVITE::')
        ? 'Mengajak kamu sparing! Buka aplikasi untuk menerima.'
        : content.slice(0, 180),
      data: { type: 'message', matchId: message.match_id },
    };

    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([pushMessage]),
    });
    if (!pushRes.ok) {
      await rest(`push_dedupe?dedupe_key=eq.${encodeURIComponent(dedupeKey)}`, { method: 'DELETE' });
      claimedKey = null;
      return json({ error: 'push_failed' }, 502);
    }

    return json({ success: true });
  } catch (err: any) {
    if (claimedKey) {
      await rest(`push_dedupe?dedupe_key=eq.${encodeURIComponent(claimedKey)}`, { method: 'DELETE' }).catch(() => {});
    }
    console.error('notify-message error:', err?.message);
    return json({ error: 'internal_error' }, 500);
  }
});
