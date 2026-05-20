import re
import os

path = "/Users/louismusolff/Anfragen Manger/stollberg/desktop.html"
with open(path, 'r', encoding='utf-8') as f:
    orig_content = f.read()

content = orig_content

# 14. Fix the transfer function & modal
# Finding the modal HTML and replacing it with a select
modal_pattern = r'<div id="transferModal"[\s\S]*?</div>\s*</div>'
new_modal = """<div id="transferModal" class="modal">
  <div class="modal-content">
    <h3>Termin verschieben</h3>
    <p>Wähle einen Mitarbeiter aus:</p>
    <select id="transferTarget" style="width:100\%; padding:10px; margin:15px 0; border:1px solid #ddd; border-radius:8px;">
      <option value="">Lade Mitarbeiter...</option>
    </select>
    <div class="modal-actions">
      <button class="secondary" onclick="closeModal('transferModal')">Abbrechen</button>
      <button class="primary" onclick="confirmTransfer()">Verschieben</button>
    </div>
  </div>
</div>"""
content = re.sub(modal_pattern, new_modal, content)

# 14. Adjust openTransfer script to populate the select
open_transfer_script = """function openTransfer(id) {
  currentSessionId = id;
  showModal('transferModal');
  const sel = document.getElementById('transferTarget');
  if (sel) {
    firebase.database().ref('stollbergMitarbeiter').once('value').then(snap => {
      const data = snap.val() || {};
      let html = '<option value="">-- Bitte wählen --</option>';
      for (const key in data) {
        if (key !== OWNER) {
          html += `<option value="${key}">${data[key].name || key}</option>`;
        }
      }
      sel.innerHTML = html;
    });
  }
}"""
content = re.sub(r"function openTransfer\(id\) \{[\s\S]*?showModal\('transferModal'\);\s*\}", open_transfer_script, content)

# 14. Adjust confirmTransfer script
confirm_transfer_script = """function confirmTransfer() {
  const targetEmpId = document.getElementById('transferTarget').value;
  if (!targetEmpId) { alert('Bitte Mitarbeiter wählen'); return; }
  
  const sess = sessions.find(s => s.id === currentSessionId);
  if (!sess) return;

  const updates = {
    owner: targetEmpId,
    _lastUpdate: firebase.database.ServerValue.TIMESTAMP
  };

  db.ref('stollbergSessions/' + currentSessionId).update(updates).then(() => {
    // Notify
    const notifId = 'notif_' + Date.now();
    db.ref('stollbergNotifications/' + targetEmpId + '/' + notifId).set({
      id: notifId,
      sessionId: currentSessionId,
      from: OWNER,
      personName: sess.personName || 'Unbekannt',
      datum: sess.datum || '',
      uhrzeit: sess.uhrzeit || '',
      ts: firebase.database.ServerValue.TIMESTAMP,
      gelesen: false
    });

    writeLog('Person verschoben', sess.personName + ` → ${targetEmpId}`, sess);
    closeModal('transferModal');
  });
}"""

# Handle potential existing confirmTransfer
content = re.sub(r"function confirmTransfer\(\) \{[\s\S]*?writeLog\('Person verschoben'[\s\S]*?closeModal\('transferModal'\);\s*\}\s*\}", confirm_transfer_script, content)
# If the regex above didn't match (e.g. slight variation), try a simpler one or replace by marker if I knew one.
# Given it's a large file, I'll attempt a more robust replacement for the function.
if 'function confirmTransfer()' in content and confirm_transfer_script not in content:
    # This is a bit risky but we'll try to find the block
    content = re.sub(r"function confirmTransfer\(\) \{[\s\S]*?function", confirm_transfer_script + "\n\nfunction", content, count=1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
