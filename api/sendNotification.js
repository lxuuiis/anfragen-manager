import { Resend } from 'resend';
import { FROM, REPLY_TO, FIREBASE_DB, buildRejectionMail, buildTerminChangeMail, buildCustomerResponseMail } from './_mail.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { anfrageId, type, reason, oldTermin, newTermin, response } = req.body || {};
    if (!anfrageId || !type) return res.status(400).json({ error: 'anfrageId und type erforderlich' });

    const dbRes = await fetch(`${FIREBASE_DB}/verkaufAnfragen/${encodeURIComponent(anfrageId)}.json`);
    if (!dbRes.ok) return res.status(502).json({ error: 'Firebase fetch failed' });
    const anfrage = await dbRes.json();
    if (!anfrage) return res.status(404).json({ error: 'Anfrage nicht gefunden' });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY nicht konfiguriert' });
    const resend = new Resend(apiKey);

    let subject, html, flag, recipients;
    if (type === 'rejected') {
      const email = anfrage.buyer && anfrage.buyer.email;
      if (!email) return res.status(400).json({ error: 'Keine Mail-Adresse hinterlegt' });
      subject    = 'Deine Möbel-Anfrage wurde leider abgelehnt';
      html       = buildRejectionMail(anfrage, reason || '');
      flag       = 'rejectionMailedAt';
      recipients = [email];
    } else if (type === 'termin') {
      const email = anfrage.buyer && anfrage.buyer.email;
      if (!email) return res.status(400).json({ error: 'Keine Mail-Adresse hinterlegt' });
      subject    = 'Terminvorschlag für deine Möbel-Anfrage — bitte bestätigen';
      html       = buildTerminChangeMail(anfrage, oldTermin || '', newTermin || '');
      flag       = 'terminChangeMailedAt';
      recipients = [email];
    } else if (type === 'customerResponse') {
      // Mail an Louis & Rohat (interner Inbox)
      if (!response || !['accepted','rejected'].includes(response)) {
        return res.status(400).json({ error: 'response muss accepted oder rejected sein' });
      }
      const buyerName = (anfrage.buyer && anfrage.buyer.name) || 'Käufer';
      subject    = response === 'accepted'
        ? `✓ ${buyerName} hat den Termin bestätigt`
        : `✗ ${buyerName} hat den Termin abgelehnt`;
      html       = buildCustomerResponseMail(anfrage, response);
      flag       = response === 'accepted' ? 'customerAcceptedMailedAt' : 'customerRejectedMailedAt';
      recipients = REPLY_TO.length ? REPLY_TO : ['louis.musolff@iav.de','rohat.turgut@iav.de'];
    } else {
      return res.status(400).json({ error: 'Unbekannter type: ' + type });
    }

    const { error } = await resend.emails.send({
      from:     FROM,
      to:       recipients,
      reply_to: REPLY_TO,
      subject,
      html,
    });
    if (error) return res.status(502).json({ error: error.message || 'Resend-Fehler' });

    await fetch(`${FIREBASE_DB}/verkaufAnfragen/${encodeURIComponent(anfrageId)}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ [flag]: Date.now() }),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message || err) });
  }
}
