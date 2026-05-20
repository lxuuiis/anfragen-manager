import { Resend } from 'resend';
import { FROM, REPLY_TO, FIREBASE_DB, buildDelayedMail } from '../_mail.js';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY nicht konfiguriert' });
    const resend = new Resend(apiKey);

    const dbRes = await fetch(`${FIREBASE_DB}/stollbergVerkaufAnfragen.json`);
    if (!dbRes.ok) return res.status(502).json({ error: 'Firebase fetch failed' });
    const all = (await dbRes.json()) || {};
    const now = Date.now();

    const candidates = Object.entries(all).filter(([, a]) => {
      if (!a) return false;
      if (a.status !== 'pending') return false;
      if (!a.createdAt || now - a.createdAt < TWO_DAYS_MS) return false;
      if (a.delayedNotifiedAt) return false;
      if (!(a.buyer && a.buyer.email)) return false;
      return true;
    });

    const results = [];
    for (const [id, a] of candidates) {
      try {
        const html = buildDelayedMail(a);
        const { error } = await resend.emails.send({
          from:     FROM,
          to:       [a.buyer.email],
          reply_to: REPLY_TO,
          subject:  'Update: Deine Möbel-Anfrage verzögert sich kurz',
          html,
        });
        if (error) { results.push({ id, ok:false, err: error.message }); continue; }

        await fetch(`${FIREBASE_DB}/stollbergVerkaufAnfragen/${encodeURIComponent(id)}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ delayedNotifiedAt: now }),
        });
        results.push({ id, ok:true });
      } catch (e) {
        results.push({ id, ok:false, err: String(e && e.message || e) });
      }
    }

    return res.status(200).json({ ok:true, checked: Object.keys(all).length, notified: results.length, results });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message || err) });
  }
}
