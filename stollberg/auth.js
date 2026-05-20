/* ── IAV Möbelmarkt Stollberg · Passwort-Schutz (shared) ──
   Einmal pro Session entsperrt, gilt für alle Stollberg-Seiten. */
(function(){
  const PW  = 'Stolli2026';
  const KEY = 'stollbergAuthOk';

  if (sessionStorage.getItem(KEY) === '1') return; // schon entsperrt

  const hideStyle = document.createElement('style');
  hideStyle.id = 'stollbergAuthHide';
  hideStyle.textContent = 'body > *:not(#stollbergAuthOverlay){visibility:hidden !important;}';
  (document.head || document.documentElement).appendChild(hideStyle);

  function mountOverlay(){
    if (document.getElementById('stollbergAuthOverlay')) return;
    const div = document.createElement('div');
    div.id = 'stollbergAuthOverlay';
    div.style.cssText = 'position:fixed;inset:0;background:#f5f5f7;z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    div.innerHTML = `
      <div style="background:#fff;border:1px solid #e0e0e0;border-radius:14px;padding:36px 30px;max-width:340px;width:90%;box-shadow:0 8px 40px rgba(0,0,0,0.14);text-align:center;">
        <div style="font-size:32px;margin-bottom:14px;">🔒</div>
        <h2 style="font-size:18px;font-weight:700;margin:0 0 6px;color:#1c1c1e;">IAV Möbelmarkt Stollberg</h2>
        <p style="font-size:13px;color:#6e6e73;margin:0 0 22px;">Bitte Passwort eingeben, um fortzufahren</p>
        <input type="password" id="stollbergAuthInput" placeholder="Passwort…" autocomplete="current-password" style="width:100%;font-size:15px;padding:11px 14px;border:1.5px solid #e0e0e0;border-radius:8px;outline:none;margin-bottom:10px;font-family:inherit;box-sizing:border-box;" />
        <div id="stollbergAuthError" style="font-size:12px;color:#d93025;margin-bottom:10px;min-height:16px;"></div>
        <button id="stollbergAuthBtn" type="button" style="width:100%;background:#0071e3;color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Weiter →</button>
        <div style="margin-top:22px;padding-top:18px;border-top:1px solid #ececec;font-size:12px;color:#6e6e73;line-height:1.5;">
          Falls du Möbel kaufen möchtest:
          <br/>
          <a href="/stollberg/verkauf.html" style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;color:#5B2FE5;text-decoration:none;font-weight:600;font-size:13px;">
            Zur Möbel-Buchungsseite
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
        </div>
      </div>`;
    document.body.appendChild(div);

    const input = document.getElementById('stollbergAuthInput');
    const err   = document.getElementById('stollbergAuthError');
    const btn   = document.getElementById('stollbergAuthBtn');

    function check(){
      if (input.value === PW){
        sessionStorage.setItem(KEY, '1');
        div.remove();
        const s = document.getElementById('stollbergAuthHide');
        if (s) s.remove();
      } else {
        err.textContent = 'Falsches Passwort – bitte erneut versuchen';
        input.value = '';
        input.focus();
      }
    }
    btn.addEventListener('click', check);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
    setTimeout(() => input.focus(), 60);
  }

  if (document.body) mountOverlay();
  else document.addEventListener('DOMContentLoaded', mountOverlay);
})();
