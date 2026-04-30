import { Resend } from 'resend';
import { FROM, REPLY_TO, FIREBASE_DB, buildConfirmationMail } from './_mail.js';

export default async function handler(req, res) {
  // CORS (verkauf.html may be served from same origin on Vercel, but be permissive for testing)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { anfrageId } = req.body || {};
    if (!anfrageId) return res.status(400).json({ error: 'anfrageId fehlt' });

    // Pull the request from Firebase RTDB via REST
    const dbRes = await fetch(`${FIREBASE_DB}/verkaufAnfragen/${encodeURIComponent(anfrageId)}.json`);
    if (!dbRes.ok) return res.status(502).json({ error: 'Firebase fetch failed' });
    const anfrage = await dbRes.json();
    if (!anfrage) return res.status(404).json({ error: 'Anfrage nicht gefunden' });

    const email = (anfrage.buyer && anfrage.buyer.email) || '';
    if (!email) return res.status(400).json({ error: 'Keine Mail-Adresse hinterlegt' });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY nicht konfiguriert' });

    const resend = new Resend(apiKey);
    const html   = buildConfirmationMail(anfrage);

    const { error } = await resend.emails.send({
      from:    FROM,
      to:      [email],
      reply_to: REPLY_TO,
      subject: 'Deine Anfrage im IAV Möbelmarkt ist eingegangen',
      html,
    });
    if (error) return res.status(502).json({ error: error.message || 'Resend-Fehler' });

    // Mark as confirmation-sent so we don't double-send
    await fetch(`${FIREBASE_DB}/verkaufAnfragen/${encodeURIComponent(anfrageId)}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ confirmationSentAt: Date.now() }),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message || err) });
  }
}
