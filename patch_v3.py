import re
import os

path = "/Users/louismusolff/Anfragen Manger/stollberg/desktop.html"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Title change
content = content.replace("<title>Anfragen Manager · Louis</title>", "<title>Anfragen · Stollberg</title>")

# 2. Script path fixes
content = content.replace("../../theme.js", "../theme.js")
content = content.replace("../../shared.css", "../shared.css")
content = content.replace("../../auth.js", "./auth.js")

# 3. Back link
content = content.replace('href="../../Manger.html"', 'href="./index.html"')

# 5. API endpoint
content = content.replace("/api/sendNotification", "/api/stollberg/sendNotification")

# 6. Transfer button
content = content.replace("→ R", "→ Transfer")
content = content.replace('title="Zu Rohat verschieben"', 'title="Zu anderem MA"')

# 7. Owner CSS class
content = content.replace("--owner-color: var(--louis-c)", "--owner-color: #0071e3")
content = re.sub(r"nav-brand \.owner-tag\s*\{[^}]*\}", "", content)

# 8. OWNER constant
content = content.replace("const OWNER = 'louis';", """const urlParams = new URLSearchParams(window.location.search);
const OWNER_ID = urlParams.get('user') || '';
let OWNER = OWNER_ID;""")

# 9. DB_PATH
content = content.replace("const DB_PATH = 'sessions';", "const DB_PATH = 'stollbergSessions';")

# 10. Dynamic title and employee check
dynamic_check = """
<script>
// Load employee info dynamically
const _urlParams = new URLSearchParams(window.location.search);
const _ownerId = _urlParams.get('user') || '';
if (!_ownerId) {
  document.addEventListener('DOMContentLoaded', () => {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;"><div style="text-align:center;"><h2>Kein Mitarbeiter angegeben</h2><p style="color:#6e6e73;margin-top:8px;">Bitte über das <a href="./index.html">Dashboard</a> öffnen.</p></div></div>';
  });
}
</script>"""
content = content.replace('<script src="./auth.js"></script>', '<script src="./auth.js"></script>' + dynamic_check)

# 11. Remove hardcoded Louis in nav tag
content = content.replace('<span class="owner-tag">Louis</span>', '<span class="owner-tag" id="ownerTag">…</span>')

# 12. Add script at the end
end_script = """
<script>
// Override OWNER with dynamic data and update UI
if (_ownerId) {
  firebase.database().ref('stollbergMitarbeiter/' + _ownerId).once('value').then(snap => {
    const emp = snap.val();
    if (emp) {
      OWNER = _ownerId;
      const tag = document.getElementById('ownerTag');
      if (tag) tag.textContent = emp.name || _ownerId;
      document.title = 'Anfragen · ' + (emp.name || _ownerId);
      // Apply employee color
      if (emp.color) {
        document.documentElement.style.setProperty('--owner-color', emp.color);
        const ownerTagEl = document.getElementById('ownerTag');
        if (ownerTagEl) ownerTagEl.style.background = emp.color;
      }
      // Update notifications listener with correct owner
      if (typeof db !== 'undefined' && db) {
        db.ref('stollbergNotifications/' + _ownerId).on('value', snap => {
          const raw = snap.val();
          const bar  = document.getElementById('notifBar');
          const list = document.getElementById('notifList');
          if (!raw) { bar && bar.classList.remove('has-notifs'); if(list) list.innerHTML = ''; return; }
          const items = Object.values(raw).filter(n => !n.gelesen).sort((a,b) => (b.ts||0)-(a.ts||0));
          if (!items.length) { bar && bar.classList.remove('has-notifs'); if(list) list.innerHTML = ''; return; }
          bar && bar.classList.add('has-notifs');
          if(list) list.innerHTML = items.map(n => {
            return `<div class="notif-item" onclick="notifJump('${n.id}','${n.sessionId}')">
              <span class="notif-bell">🔔</span>
              <span class="notif-text"><strong>${n.from||'?'}</strong> hat <strong>${n.personName||'?'}</strong> zu dir verschoben · Termin: ${n.datum||''} ${n.uhrzeit||''}</span>
              <span class="notif-arrow">→ Zum Termin</span>
              <button class="notif-dismiss" onclick="notifDismiss(event,'${n.id}')" title="Schließen">×</button>
            </div>`;
          }).join('');
        });
      }
    } else {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;"><div style="text-align:center;"><h2>Mitarbeiter nicht gefunden</h2><p style="color:#6e6e73;margin-top:8px;">Zurück zum <a href="./index.html">Dashboard</a></p></div></div>';
    }
  }).catch(e => console.error('Employee load error:', e));
}
</script>
</body>"""
if "</body>" in content and end_script not in content:
    content = content.replace("</body>", end_script)

# 13 & 17. Fix notification dismiss
content = content.replace("db.ref('notifications/louis/' + notifId)", "db.ref('stollbergNotifications/' + _ownerId + '/' + notifId)")

# 15. deleteSession
content = content.replace("_trashedBy: 'Louis'", "_trashedBy: OWNER")

# 16. exportCSV
content = content.replace("Anfragen Export – Louis\\n", "Anfragen Export – Stollberg\\n")

# 4. Firebase paths
content = content.replace("'sessions/'", "'stollbergSessions/'")
content = content.replace("'sessions'", "'stollbergSessions'")
content = content.replace("'archiv/'", "'stollbergArchiv/'")
content = content.replace("'archiv'", "'stollbergArchiv'")
content = content.replace("'moebel/'", "'stollbergMoebel/'")
content = content.replace("'moebel'", "'stollbergMoebel'")
content = content.replace("'moebelDropdownKatalog'", "'stollbergMoebelDropdownKatalog'")
content = content.replace("'logs/'", "'stollbergLogs/'")
content = content.replace("'logs'", "'stollbergLogs'")
content = content.replace("'extern_verkauf'", "'stollbergExtern'")
content = content.replace("'verkaufAnfragen'", "'stollbergVerkaufAnfragen'")
content = content.replace("'trash/'", "'stollbergTrash/'")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
