export const config = { maxDuration: 60 };

const SB_URL = 'https://tnmmbfcbviowhunnrzix.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubW1iZmNidmlvd2h1bm5yeml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTc4MzcsImV4cCI6MjA4OTc5MzgzN30.ZZD8evIrlfY_77-DEh47L-JJxFOxhH8L9xZ_NjHN6QU';

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(`OAuth error: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

function decodeBase64(str: string): string {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractBody(payload: any): string {
  if (payload?.body?.data) return decodeBase64(payload.body.data);
  if (payload?.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) return decodeBase64(part.body.data);
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64(part.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }
  return '';
}

async function classifyWithClaude(
  asunto: string,
  cuerpo: string,
  de: string,
): Promise<{ categoria: string; resumen: string; respuesta_sugerida: string }> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  if (!apiKey) return { categoria: 'info', resumen: asunto.slice(0, 80), respuesta_sugerida: '' };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Sos el asistente de FromNorth, una marca de indumentaria argentina. Analizá este email y respondé SOLO con JSON válido, sin texto extra.

De: ${de}
Asunto: ${asunto}
Cuerpo: ${cuerpo.slice(0, 800)}

Respondé exactamente con este JSON:
{
  "categoria": "urgente|reclamo|consulta|positivo|info|spam",
  "resumen": "resumen en 1 línea corta (max 80 caracteres)",
  "respuesta_sugerida": "respuesta lista para enviar, tono amigable y profesional, español rioplatense"
}`,
      }],
    }),
  });

  if (!res.ok) return { categoria: 'info', resumen: asunto.slice(0, 80), respuesta_sugerida: '' };
  const data = await res.json() as any;
  const text: string = data.content?.[0]?.text?.trim() ?? '';

  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no json');
    return JSON.parse(match[0]);
  } catch {
    return { categoria: 'info', resumen: asunto.slice(0, 80), respuesta_sugerida: '' };
  }
}

export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const accessToken = await getAccessToken();

    // Últimos 30 mails de inbox
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&q=in:inbox',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!listRes.ok) throw new Error(`Gmail list error: ${listRes.status}`);
    const listData = await listRes.json() as any;
    const messages: { id: string; threadId: string }[] = listData.messages ?? [];

    if (messages.length === 0) {
      res.status(200).json({ ok: true, synced: 0 });
      return;
    }

    const mailRows = await Promise.all(
      messages.map(async ({ id, threadId }) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!msgRes.ok) return null;
        const msg = await msgRes.json() as any;

        const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
        const getHeader = (name: string) =>
          headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

        const fromHeader = getHeader('From');
        const emailMatch = fromHeader.match(/<(.+?)>/) ?? fromHeader.match(/(\S+@\S+)/);
        const nameMatch  = fromHeader.match(/^"?([^"<]+)"?\s*</);
        const de     = emailMatch?.[1] ?? fromHeader;
        const nombre = nameMatch?.[1]?.trim() ?? de;

        const asunto = getHeader('Subject');
        const fecha  = new Date(parseInt(msg.internalDate ?? '0')).toISOString();
        const leido  = !((msg.labelIds ?? []) as string[]).includes('UNREAD');
        const cuerpo = extractBody(msg.payload);

        const classified = await classifyWithClaude(asunto, cuerpo, de);

        return {
          id,
          thread_id: threadId,
          de,
          nombre,
          asunto,
          cuerpo,
          fecha,
          leido,
          categoria: classified.categoria,
          resumen: classified.resumen,
          respuesta_sugerida: classified.respuesta_sugerida,
        };
      }),
    );

    const validRows = mailRows.filter(Boolean);

    if (validRows.length > 0) {
      const sbRes = await fetch(`${SB_URL}/rest/v1/mails`, {
        method: 'POST',
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(validRows),
      });
      if (!sbRes.ok) throw new Error(`Supabase upsert failed: ${sbRes.status}`);
    }

    res.status(200).json({ ok: true, synced: validRows.length });
  } catch (err: any) {
    console.error('[gmail-sync] error:', err?.message ?? err);
    res.status(500).json({ ok: false, error: String(err?.message ?? err) });
  }
}
