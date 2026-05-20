// /api/chat.js — Anthropic Claude Haiku Chat Agent für Anfragen Manager
// ----------------------------------------------------------------------
// Tools: list_anfragen, set_formular_erhalten, get_stats, find_by_name
// Datenquelle: Firebase Realtime DB REST (sessions/, archiv/)
//
// Setup: `vercel env add ANTHROPIC_API_KEY` (production + preview + development)

const FALLBACK_ANTHROPIC_KEY = null;

const FIREBASE_DB    = 'https://manager-3cf2b-default-rtdb.europe-west1.firebasedatabase.app';
const ANTHROPIC_URL  = 'https://api.anthropic.com/v1/messages';
const MODEL_PRIMARY  = 'claude-haiku-4-5';
const MODEL_FALLBACK = 'claude-3-5-haiku-latest';
const MAX_TOOL_ITERATIONS = 6;

// ── Tool-Definitionen für Claude ─────────────────────────────────────
const TOOLS = [
  {
    name: 'list_anfragen',
    description:
      'Listet aktive Anfragen (Personen) aus Firebase. Filtert optional nach status (Offen|Reservierung|Abholung), owner (louis|rohat) oder einem Such-Query (matched gegen Namen). Gibt pro Person: sessionId, personIdx, name, owner, status, fe, fw, terminDatum, terminUhrzeit, moebel.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['Offen', 'Reservierung', 'Abholung'] },
        owner:  { type: 'string', enum: ['louis', 'rohat'] },
        query:  { type: 'string', description: 'Teil-String des Namens (case-insensitive).' }
      }
    }
  },
  {
    name: 'find_by_name',
    description:
      'Sucht Personen anhand eines (Teil-)Namens. Liefert Treffer mit sessionId, personIdx, vollem Namen, owner, status, fe. Mehrere Treffer möglich.',
    input_schema: {
      type: 'object',
      required: ['namePattern'],
      properties: {
        namePattern: { type: 'string', description: 'Name oder Teil-Name (case-insensitive).' }
      }
    }
  },
  {
    name: 'set_formular_erhalten',
    description:
      'Setzt das Feld "fe" (Formular erhalten) für eine oder mehrere Personen auf "Ja" oder "Nein". Erwartet eine Liste targets: jeweils {sessionId, personIdx}. Verwende zuerst find_by_name, um die korrekten IDs zu ermitteln.',
    input_schema: {
      type: 'object',
      required: ['targets', 'value'],
      properties: {
        value:   { type: 'string', enum: ['Ja', 'Nein'] },
        targets: {
          type: 'array',
          items: {
            type: 'object',
            required: ['sessionId', 'personIdx'],
            properties: {
              sessionId: { type: ['string', 'number'] },
              personIdx: { type: 'number' }
            }
          }
        }
      }
    }
  },
  {
    name: 'get_stats',
    description:
      'Gibt Zählungen über alle aktiven Anfragen zurück: total Sessions, Personen total, gruppiert nach status und nach owner; Anzahl fe=Ja, fe=Nein, fw=Ja, fw=Nein.',
    input_schema: { type: 'object', properties: {} }
  }
];

// ── Firebase Helpers ─────────────────────────────────────────────────
async function fbGet(path) {
  const r = await fetch(`${FIREBASE_DB}/${path}.json`);
  if (!r.ok) throw new Error(`Firebase GET ${path} → ${r.status}`);
  return await r.json();
}
async function fbPatch(path, body) {
  const r = await fetch(`${FIREBASE_DB}/${path}.json`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Firebase PATCH ${path} → ${r.status}`);
  return await r.json();
}

// ── Daten flatten: ein Eintrag pro Person ────────────────────────────
async function loadAllPersonen() {
  const sessions = await fbGet('sessions') || {};
  const out = [];
  for (const [sid, s] of Object.entries(sessions)) {
    if (!s || !Array.isArray(s.personen)) continue;
    s.personen.forEach((p, idx) => {
      if (!p || !p.name || !String(p.name).trim()) return;
      out.push({
        sessionId:     sid,
        personIdx:     idx,
        name:          p.name,
        owner:         s.owner || '',
        status:        p.status || '',
        fe:            p.fe || 'Nein',
        fw:            p.fw || 'Nein',
        terminDatum:   s.datum || '',
        terminUhrzeit: s.uhrzeit || '',
        tische:        p.tische || 0,
        stuehle:       p.stuehle || 0,
        bem:           p.bem || '',
        abh_datum:     p.abh_datum || '',
        abh_zeit:      p.abh_zeit || '',
        moebel:        Array.isArray(p.moebel) ? p.moebel : []
      });
    });
  }
  return out;
}

function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

// ── Tool-Implementierungen ───────────────────────────────────────────
async function tool_list_anfragen({ status, owner, query }) {
  const all = await loadAllPersonen();
  const q = query ? norm(query) : null;
  return all.filter(p =>
    (!status || p.status === status) &&
    (!owner  || p.owner  === owner)  &&
    (!q      || norm(p.name).includes(q))
  );
}

async function tool_find_by_name({ namePattern }) {
  if (!namePattern) return [];
  const q = norm(namePattern);
  const all = await loadAllPersonen();
  return all
    .filter(p => norm(p.name).includes(q))
    .map(p => ({
      sessionId: p.sessionId, personIdx: p.personIdx,
      name: p.name, owner: p.owner, status: p.status,
      fe: p.fe, fw: p.fw,
      terminDatum: p.terminDatum, terminUhrzeit: p.terminUhrzeit
    }));
}

async function tool_set_formular_erhalten({ targets, value }) {
  if (!Array.isArray(targets) || !targets.length) return { ok: false, error: 'Keine targets angegeben.' };
  if (value !== 'Ja' && value !== 'Nein')         return { ok: false, error: 'value muss Ja oder Nein sein.' };
  const updated = [];
  const errors  = [];
  for (const t of targets) {
    const sid = String(t.sessionId);
    const idx = Number(t.personIdx);
    if (!sid || Number.isNaN(idx)) { errors.push({ target: t, error: 'Ungültige IDs' }); continue; }
    try {
      // PATCH auf Personen-Objekt: sessions/{sid}/personen/{idx}.json mit { fe: value }
      await fbPatch(`sessions/${encodeURIComponent(sid)}/personen/${idx}`, { fe: value });
      updated.push({ sessionId: sid, personIdx: idx });
    } catch (e) {
      errors.push({ target: t, error: e.message });
    }
  }
  return { ok: errors.length === 0, updatedCount: updated.length, updated, errors };
}

async function tool_get_stats() {
  const all = await loadAllPersonen();
  const sessionsRaw = await fbGet('sessions') || {};
  const byOwner = {};
  const byStatus = { Offen: 0, Reservierung: 0, Abholung: 0 };
  let feJa = 0, feNein = 0, fwJa = 0, fwNein = 0;
  for (const p of all) {
    byOwner[p.owner] = (byOwner[p.owner] || 0) + 1;
    if (byStatus[p.status] !== undefined) byStatus[p.status]++;
    if (p.fe === 'Ja') feJa++; else feNein++;
    if (p.fw === 'Ja') fwJa++; else fwNein++;
  }
  return {
    totalSessions: Object.keys(sessionsRaw).length,
    totalPersonen: all.length,
    byOwner, byStatus,
    formularErhalten: { Ja: feJa, Nein: feNein },
    formularWeitergeleitet: { Ja: fwJa, Nein: fwNein }
  };
}

async function runTool(name, input) {
  try {
    if (name === 'list_anfragen')          return await tool_list_anfragen(input || {});
    if (name === 'find_by_name')           return await tool_find_by_name(input || {});
    if (name === 'set_formular_erhalten')  return await tool_set_formular_erhalten(input || {});
    if (name === 'get_stats')              return await tool_get_stats();
    return { error: `Unbekanntes Tool: ${name}` };
  } catch (e) {
    return { error: e.message || String(e) };
  }
}

// ── Anthropic-Aufruf ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `Du bist der AI-Assistent im "Anfragen Manager" — einem Tool zur Verwaltung von Möbel-Abholterminen bei IAV.

Kontext der Daten:
• Jede "Session" in Firebase enthält einen Termin (datum, uhrzeit, owner) mit einem Array "personen".
• owner ist entweder "louis" oder "rohat" (Sachbearbeiter).
• Jede Person hat: name, status (Offen|Reservierung|Abholung), fe (Formular erhalten: Ja|Nein), fw (Formular weitergeleitet: Ja|Nein), tische, stuehle, bem, moebel.
• "Formular erhalten" = das Feld "fe". Wenn der User sagt "setze X auf Formular erhalten", dann fe='Ja'. "Formular noch nicht da" → fe='Nein'.

Arbeitsweise:
1. Antworte immer auf Deutsch, freundlich und prägnant.
2. Bevor du etwas änderst (set_formular_erhalten), nutze find_by_name um die exakten IDs zu finden.
3. Bei mehreren Treffern: liste die Treffer kurz auf und frage nach (nur wenn wirklich mehrdeutig). Bei eindeutigem Treffer einfach ausführen.
4. Nach einer Änderung bestätige knapp ("✓ Tobias Balecke auf Formular erhalten gesetzt").
5. Für Übersichts-/Statistik-Fragen nutze get_stats oder list_anfragen.
6. Erfinde keine Namen. Wenn niemand passt, sag das ehrlich.`;

async function callAnthropic({ apiKey, model, messages, system }) {
  const r = await fetch(ANTHROPIC_URL, {
    method:  'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      tools: TOOLS,
      messages
    })
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    const err = new Error(`Anthropic ${r.status}: ${msg}`);
    err.status = r.status;
    err.body = data;
    throw err;
  }
  return data;
}

// ── HTTP-Handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY || FALLBACK_ANTHROPIC_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const inputMessages = Array.isArray(body.messages) ? body.messages : [];
    if (!inputMessages.length) return res.status(400).json({ error: 'messages erforderlich' });

    // Conversation für Claude vorbereiten (history + neue user message bereits enthalten)
    const messages = inputMessages.map(m => ({
      role:    m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

    const actions = [];
    let model = MODEL_PRIMARY;
    let reply = '';

    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      let resp;
      try {
        resp = await callAnthropic({ apiKey, model, messages, system: SYSTEM_PROMPT });
      } catch (e) {
        // Fallback-Modell bei 404 (Model not found) versuchen — nur beim 1. Iterations-Versuch
        if (iter === 0 && model === MODEL_PRIMARY && (e.status === 404 || /model/i.test(e.message))) {
          model = MODEL_FALLBACK;
          resp  = await callAnthropic({ apiKey, model, messages, system: SYSTEM_PROMPT });
        } else {
          throw e;
        }
      }

      const assistantContent = resp.content || [];
      // Assistant-Turn in Conversation aufnehmen
      messages.push({ role: 'assistant', content: assistantContent });

      // Text-Teile sammeln
      const textParts = assistantContent.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
      if (textParts) reply = textParts;

      if (resp.stop_reason !== 'tool_use') break;

      // Alle tool_use-Blöcke ausführen und als ein user-Turn mit tool_result zurückspielen
      const toolUses = assistantContent.filter(c => c.type === 'tool_use');
      if (!toolUses.length) break;

      const toolResults = [];
      for (const tu of toolUses) {
        const result = await runTool(tu.name, tu.input || {});
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result)
        });

        // UI-Action-Hint für set_formular_erhalten
        if (tu.name === 'set_formular_erhalten' && result && result.ok) {
          actions.push({
            type:  'fe_set',
            value: tu.input?.value || 'Ja',
            count: result.updatedCount,
            ids:   (result.updated || []).map(u => `${u.sessionId}/${u.personIdx}`)
          });
        }
      }

      messages.push({ role: 'user', content: toolResults });
    }

    return res.status(200).json({ reply: reply || '(keine Antwort)', actions, model });
  } catch (e) {
    console.error('[chat.js] Fehler:', e);
    return res.status(500).json({ error: e.message || 'Unbekannter Fehler' });
  }
}
