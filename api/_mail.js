// Shared mail templates for IAV Möbelmarkt
// Used by /api/sendConfirmation and /api/checkDelayed

export const FROM       = process.env.MAIL_FROM    || 'IAV Möbelmarkt <onboarding@resend.dev>';
export const REPLY_TO   = (process.env.MAIL_REPLY_TO || 'louis.musolff@iav.de,rohat.turgut@iav.de').split(',').map(s=>s.trim()).filter(Boolean);
export const FIREBASE_DB = process.env.FIREBASE_DB || 'https://manager-3cf2b-default-rtdb.europe-west1.firebasedatabase.app';

function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function moebelRows(items = []) {
  return items.map(m => {
    const label = [m.katLabel || m.kat || '', m.subLabel || ''].filter(Boolean).join(' · ');
    return `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;color:#0B0B14;">${esc(label)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;color:#5B2FE5;font-weight:700;text-align:right;white-space:nowrap;">${esc(m.qty || 1)}×</td>
    </tr>`;
  }).join('');
}

const baseStyle = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,system-ui,sans-serif;color:#0B0B14;line-height:1.55;`;

function shellHtml(inner, headline) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F4F4F8;${baseStyle}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F8;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.06);">
        <tr><td style="background:linear-gradient(135deg,#5B2FE5 0%,#7C3AED 60%,#38BDF8 130%);padding:34px 32px;color:#fff;">
          <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;font-weight:600;">IAV&nbsp;Möbel&nbsp;Verkauf</div>
          <div style="font-size:26px;font-weight:700;margin-top:8px;letter-spacing:-.01em;">${esc(headline)}</div>
        </td></tr>
        <tr><td style="padding:30px 32px 36px;font-size:15px;color:#0B0B14;">
          ${inner}
        </td></tr>
        <tr><td style="background:#FAFAFC;padding:18px 32px;border-top:1px solid #eee;font-size:12px;color:#666;text-align:center;">
          Diese Mail wurde automatisch vom IAV Möbelmarkt versendet · Bei Rückfragen einfach antworten
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

export function buildConfirmationMail(anfrage) {
  const buyer = anfrage.buyer || {};
  const wt    = anfrage.wunschTermin || {};
  const termin = (wt.datum || '') + (wt.uhrzeit ? ' · ' + wt.uhrzeit + ' Uhr' : '');
  const moebel = moebelRows(anfrage.moebel || []);

  const inner = `
    <p style="margin:0 0 18px;">Hallo ${esc(buyer.name || '')},</p>
    <p style="margin:0 0 18px;">vielen Dank für deine Anfrage im IAV Möbelmarkt. Wir haben sie erhalten und sie liegt jetzt bei <b>Louis Musolff</b> oder <b>Rohat Turgut</b> auf dem Tisch.</p>
    <p style="margin:0 0 24px;"><b>In den nächsten 2 Werktagen</b> meldet sich einer der beiden bei dir und stimmt den Termin final mit dir ab.</p>

    <div style="background:#F7F5FF;border:1px solid #E9E2FF;border-radius:10px;padding:16px 18px;margin:0 0 22px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#5B2FE5;font-weight:700;margin-bottom:6px;">Wunschtermin</div>
      <div style="font-size:18px;font-weight:700;color:#0B0B14;">${esc(termin || '—')}</div>
    </div>

    <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#666;font-weight:700;margin:0 0 8px;">Deine Auswahl</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:10px;overflow:hidden;margin-bottom:22px;">
      ${moebel || '<tr><td style="padding:14px;font-size:13px;color:#888;">Keine Möbel</td></tr>'}
    </table>

    ${anfrage.notiz ? `<div style="font-size:13px;color:#555;font-style:italic;border-left:3px solid #5B2FE5;padding:6px 12px;margin:0 0 22px;">„${esc(anfrage.notiz)}"</div>` : ''}

    <p style="margin:0 0 8px;font-size:14px;color:#444;">Falls etwas dringend ist oder sich was ändert, kannst du auf diese Mail einfach antworten.</p>
    <p style="margin:0;font-size:14px;color:#444;">Beste Grüße<br><b>IAV Möbelmarkt</b></p>
  `;
  return shellHtml(inner, 'Anfrage erhalten ✓');
}

export function buildDelayedMail(anfrage) {
  const buyer = anfrage.buyer || {};
  const wt    = anfrage.wunschTermin || {};
  const termin = (wt.datum || '') + (wt.uhrzeit ? ' · ' + wt.uhrzeit + ' Uhr' : '');
  const moebel = moebelRows(anfrage.moebel || []);

  const inner = `
    <p style="margin:0 0 18px;">Hallo ${esc(buyer.name || '')},</p>
    <p style="margin:0 0 18px;">deine Möbel-Anfrage liegt aktuell noch in unserer Inbox — sie konnte in den letzten 2 Werktagen leider noch nicht bearbeitet werden.</p>
    <p style="margin:0 0 22px;"><b>Sie verzögert sich also etwas</b>, ist aber nicht vergessen. Louis oder Rohat melden sich bei dir, sobald es wieder passt.</p>

    <div style="background:#FFF8E6;border:1px solid #FFE9A8;border-radius:10px;padding:16px 18px;margin:0 0 22px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#B97A00;font-weight:700;margin-bottom:6px;">Status</div>
      <div style="font-size:16px;font-weight:600;color:#0B0B14;">Bearbeitung verzögert sich · wir kommen auf dich zu</div>
    </div>

    <div style="background:#F7F5FF;border:1px solid #E9E2FF;border-radius:10px;padding:16px 18px;margin:0 0 22px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#5B2FE5;font-weight:700;margin-bottom:6px;">Dein Wunschtermin</div>
      <div style="font-size:18px;font-weight:700;color:#0B0B14;">${esc(termin || '—')}</div>
    </div>

    <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#666;font-weight:700;margin:0 0 8px;">Deine Auswahl</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:10px;overflow:hidden;margin-bottom:22px;">
      ${moebel || '<tr><td style="padding:14px;font-size:13px;color:#888;">Keine Möbel</td></tr>'}
    </table>

    <p style="margin:0 0 8px;font-size:14px;color:#444;">Solltest du in der Zwischenzeit nicht mehr darauf warten können, antworte einfach auf diese Mail.</p>
    <p style="margin:0;font-size:14px;color:#444;">Danke für deine Geduld!<br><b>IAV Möbelmarkt</b></p>
  `;
  return shellHtml(inner, 'Update zu deiner Anfrage');
}
