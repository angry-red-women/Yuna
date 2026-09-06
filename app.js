const SUPABASE_URL = 'https://uoqastprrdlwlsesheoz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vCRrqr_Zi1Zg1jN-LOrV3Q_7I0LnzKu';
const STORE = 'yunaAuth';
const STATE_URL = SUPABASE_URL + '/rest/v1/yuna_state?id=eq.family';

const pawMeta = [
  { key: 'frontLeft', label: 'Vorne links', side: 'Yunas linke Seite', position: 'lower-right' },
  { key: 'frontRight', label: 'Vorne rechts', side: 'Yunas rechte Seite', position: 'lower-left' },
  { key: 'hindLeft', label: 'Hinten links', side: 'Yunas linke Seite', position: 'upper-right' },
  { key: 'hindRight', label: 'Hinten rechts', side: 'Yunas rechte Seite', position: 'upper-left' }
];

// Private Angaben stehen ausschliesslich in Supabase und nicht im öffentlichen GitHub-Code.
const initial = {
  paws: { 'Vorne links': '', 'Vorne rechts': '', 'Hinten links': '', 'Hinten rechts': '' },
  pawCareLog: [], heat: '', milk: '', vaccine: '', vaccineName: '', tick: '', tickName: '',
  tickSpring: '', tickAutumn: '', worming: '', wormingNext: '', barfAmount: '',
  travelFoodAmount: '', foodTimes: '', vetName: '', vetAddress: '', vetPhone: '', reminder: '', notes: ''
};

let session = null;
let installPrompt = null;
let data = structuredClone(initial);
let lastCloud = '';
let editorDraft = null;
let selectedPaws = new Set();

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const fmt = date => date
  ? new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date + 'T12:00:00'))
  : 'Noch offen';
const today = () => new Date().toLocaleDateString('sv-SE');
const headers = () => ({
  apikey: SUPABASE_KEY,
  Authorization: 'Bearer ' + session.access_token,
  'Content-Type': 'application/json'
});

function syncLatestPawDates(target) {
  target.paws = { 'Vorne links': '', 'Vorne rechts': '', 'Hinten links': '', 'Hinten rechts': '' };
  for (const paw of pawMeta) {
    const latest = target.pawCareLog
      .filter(entry => entry.paws.includes(paw.key))
      .map(entry => entry.date)
      .filter(Boolean)
      .sort()
      .at(-1) || '';
    target.paws[paw.label] = latest;
  }
}

function hydrate(raw = {}) {
  const target = {
    ...structuredClone(initial),
    ...raw,
    paws: { ...initial.paws, ...(raw.paws || {}) },
    pawCareLog: Array.isArray(raw.pawCareLog) ? structuredClone(raw.pawCareLog) : []
  };

  if (!target.pawCareLog.length) {
    const dates = new Map();
    for (const paw of pawMeta) {
      const date = target.paws[paw.label];
      if (!date) continue;
      if (!dates.has(date)) dates.set(date, []);
      dates.get(date).push(paw.key);
    }
    target.pawCareLog = [...dates.entries()].map(([date, paws], index) => ({
      id: `import-${date}-${index}`,
      date,
      action: 'Geschliffen',
      paws
    }));
  }

  target.pawCareLog = target.pawCareLog.filter(entry => entry?.date && Array.isArray(entry.paws));
  syncLatestPawDates(target);
  return target;
}

async function signIn(email, password) {
  const response = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error_description || result.msg || result.message || 'Anmeldung fehlgeschlagen');
  session = result;
  localStorage.setItem(STORE, JSON.stringify(result));
}

async function refresh() {
  if (!session?.refresh_token) return false;
  try {
    const response = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    const result = await response.json();
    if (!response.ok) throw Error();
    session = result;
    localStorage.setItem(STORE, JSON.stringify(result));
    return true;
  } catch {
    return false;
  }
}

async function load() {
  const response = await fetch(STATE_URL + '&select=data', { headers: headers(), cache: 'no-store' });
  if (response.status === 401 && await refresh()) return load();
  if (!response.ok) throw Error(await response.text());
  const rows = await response.json();
  const raw = rows[0]?.data || {};
  data = hydrate(raw);
  lastCloud = JSON.stringify(raw);
  render();
}

async function save() {
  const body = JSON.stringify({ data, updated_at: new Date().toISOString() });
  const response = await fetch(STATE_URL, {
    method: 'PATCH',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body
  });
  if (!response.ok) throw Error(await response.text());
  lastCloud = JSON.stringify(data);
  $('#status').classList.remove('hidden');
  setTimeout(() => $('#status').classList.add('hidden'), 2200);
}

function info(icon, title, main, sub) {
  return `<article class="info"><div class="icon">${icon}</div><h3>${title}</h3><p>${esc(sub)}</p><strong>${esc(main)}</strong></article>`;
}

function reminder(title, date) {
  return `<div class="reminder"><b>📅 ${title}</b><span>${fmt(date)}</span></div>`;
}

function latestForPaw(target, key) {
  const label = pawMeta.find(paw => paw.key === key)?.label;
  return label ? target.paws[label] : '';
}

function dogMap(target, interactive = false, selected = new Set()) {
  const paws = pawMeta.map(paw => {
    const chosen = selected.has(paw.key);
    const attribute = interactive
      ? `data-pick-paw="${paw.key}" aria-pressed="${chosen}"`
      : `data-main-paw="${paw.key}"`;
    return `<button type="button" class="map-paw ${paw.position}${chosen ? ' selected' : ''}" ${attribute} aria-label="${paw.label}: ${interactive ? 'auswählen' : 'Krallenpflege eintragen'}">
      <span class="paw-print">🐾</span><b>${paw.label}</b><small>${interactive ? paw.side : fmt(latestForPaw(target, paw.key))}</small>
    </button>`;
  }).join('');

  return `<div class="dog-map${interactive ? ' edit-map' : ''}">
    <div class="direction"><span>Schwanz ↑</span><b>Yuna von oben</b><span>↓ Kopf</span></div>
    <img class="dog-illustration" src="yuna-top-view.png?v=4" alt="Schematische Aufsicht von Yuna mit vier sichtbaren Pfoten">
    ${paws}
  </div>`;
}

function sortedLog(target) {
  return [...target.pawCareLog].sort((a, b) => b.date.localeCompare(a.date));
}

function logRow(entry, removable = false) {
  const labels = entry.paws.map(key => pawMeta.find(paw => paw.key === key)?.label).filter(Boolean).join(' · ');
  return `<div class="log-row"><div><b>${fmt(entry.date)} · ${esc(entry.action || 'Geschliffen')}</b><span>${esc(labels)}</span></div>${removable ? `<button type="button" class="remove-log" data-remove-log="${esc(entry.id)}" aria-label="Eintrag vom ${fmt(entry.date)} löschen">×</button>` : ''}</div>`;
}

function render() {
  $('#health').innerHTML =
    info('🛡️', 'Zeckenschutz', data.tickName || 'Noch offen', `Zuletzt: ${fmt(data.tick)} · Nächste Erinnerung: ${fmt(data.tickSpring)}`) +
    info('💉', 'Impfung', data.vaccineName || 'Noch offen', `Zuletzt: ${fmt(data.vaccine)}`) +
    info('〰️', 'Entwurmung', `Nächste: ${fmt(data.wormingNext)}`, `Zuletzt: ${fmt(data.worming)}`) +
    info('♡', 'Läufigkeit & Milcheinschuss', fmt(data.heat), data.milk ? `Milcheinschuss: ${fmt(data.milk)}` : 'Noch kein Milcheinschuss eingetragen');

  $('#paws').innerHTML = `<div class="paw-map-copy"><h3>Pfote direkt antippen</h3><p>Yuna ist wie auf deinem Foto von oben dargestellt: Schwanz oben, Kopf unten. Tippe die Pfote direkt an ihrer Position an.</p></div>${dogMap(data)}`;
  const entries = sortedLog(data);
  $('#pawHistory').innerHTML = entries.length ? entries.map(entry => logRow(entry)).join('') : '<p class="empty-log">Noch keine Krallenpflege eingetragen.</p>';
  $('#reminders').innerHTML = reminder('Gemäss Tierarzt', data.reminder) + reminder('Zeckenschutz Frühling', data.tickSpring) + reminder('Zeckenschutz Spätsommer', data.tickAutumn);
  $('#food').innerHTML = `<h3>🦴 Futter</h3><div class="food-block"><span class="pill">Zuhause · BARF</span><strong>2 × ${esc(data.barfAmount || '–')}</strong></div><div class="food-block"><span class="pill">Reise · Nassfutter</span><strong>2 × ${esc(data.travelFoodAmount || '–')}</strong></div><p>Jeweils ${esc(data.foodTimes || 'noch offen')}</p>`;
  $('#vet').innerHTML = `<h3>📍 Tierarzt</h3><b>${esc(data.vetName || 'Noch offen')}</b><p>${esc(data.vetAddress)}<br>${esc(data.vetPhone)}</p><a href="tel:${esc(data.vetPhone)}"><button class="outline">Jetzt anrufen</button></a>`;
  $('#holiday').innerHTML = `<h3>Wichtig in den Ferien</h3><p>${esc(data.notes || 'Noch keine Hinweise eingetragen.')}</p>`;
}

const fields = [
  ['heat', 'Letzte Läufigkeit', 'date'], ['milk', 'Milcheinschuss', 'date'],
  ['vaccine', 'Letzte Impfung', 'date'], ['vaccineName', 'Impfung / Präparat'],
  ['tick', 'Letzter Zeckenschutz', 'date'], ['tickName', 'Zeckenmittel'],
  ['tickSpring', 'Zecken-Erinnerung Frühling', 'date'], ['tickAutumn', 'Zecken-Erinnerung Spätsommer', 'date'],
  ['worming', 'Letzte Entwurmung', 'date'], ['wormingNext', 'Nächste Entwurmung laut Produkt', 'date'],
  ['reminder', 'Nächster Termin gemäss Tierarzt', 'date'], ['barfAmount', 'BARF pro Mahlzeit'],
  ['travelFoodAmount', 'Nassfutter auf Reisen pro Mahlzeit'], ['foodTimes', 'Futterzeiten'],
  ['vetName', 'Tierarzt'], ['vetPhone', 'Telefon'], ['vetAddress', 'Adresse'], ['notes', 'Ferienhinweise', 'textarea']
];

function renderPawPicker() {
  $('#pawPicker').innerHTML = dogMap(editorDraft, true, selectedPaws);
  const count = selectedPaws.size;
  $('#pawSelection').textContent = count ? `${count} ${count === 1 ? 'Pfote' : 'Pfoten'} ausgewählt` : 'Bitte Pfote(n) in der Zeichnung antippen';
}

function renderEditorLog() {
  const entries = sortedLog(editorDraft);
  $('#editorPawLog').innerHTML = entries.length ? entries.map(entry => logRow(entry, true)).join('') : '<p class="empty-log">Noch keine Einträge.</p>';
}

function openEditor(preselected = []) {
  editorDraft = structuredClone(data);
  selectedPaws = new Set(preselected);
  const pawSection = `<section class="paw-edit-panel">
    <div><h3>Krallenpflege eintragen</h3><p>Schwanz oben, Kopf unten. Du kannst auch mehrere Pfoten für dasselbe Datum auswählen.</p></div>
    <div id="pawPicker"></div><p id="pawSelection" class="selection-note"></p>
    <div class="paw-entry-fields"><label>Datum<input id="pawDate" type="date" value="${today()}"></label><label>Pflege<select id="pawAction"><option>Geschliffen</option><option>Geschnitten</option></select></label><button id="addPawLog" type="button" class="primary">Eintrag hinzufügen</button></div>
    <h3 class="editor-log-title">Bisheriger Verlauf</h3><div id="editorPawLog" class="editor-log"></div>
  </section>`;
  const otherFields = fields.map(([key, label, type = 'text']) => `<label>${label}${type === 'textarea'
    ? `<textarea data-key="${key}">${esc(editorDraft[key] || '')}</textarea>`
    : `<input data-key="${key}" type="${type}" value="${esc(editorDraft[key] || '')}">`}</label>`).join('');
  $('#fields').innerHTML = pawSection + otherFields;
  renderPawPicker();
  renderEditorLog();
  $('#editor').showModal();
}

$('#paws').onclick = event => {
  const button = event.target.closest('[data-main-paw]');
  if (button) openEditor([button.dataset.mainPaw]);
};

$('#fields').onclick = event => {
  const pawButton = event.target.closest('[data-pick-paw]');
  if (pawButton) {
    const key = pawButton.dataset.pickPaw;
    if (selectedPaws.has(key)) selectedPaws.delete(key); else selectedPaws.add(key);
    renderPawPicker();
    return;
  }

  const removeButton = event.target.closest('[data-remove-log]');
  if (removeButton) {
    editorDraft.pawCareLog = editorDraft.pawCareLog.filter(entry => entry.id !== removeButton.dataset.removeLog);
    syncLatestPawDates(editorDraft);
    renderEditorLog();
    renderPawPicker();
    return;
  }

  if (event.target.closest('#addPawLog')) {
    const date = $('#pawDate').value;
    if (!date || !selectedPaws.size) {
      $('#pawSelection').textContent = 'Bitte Datum und mindestens eine Pfote auswählen.';
      $('#pawSelection').classList.add('warning');
      return;
    }
    editorDraft.pawCareLog.push({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      date,
      action: $('#pawAction').value,
      paws: [...selectedPaws]
    });
    syncLatestPawDates(editorDraft);
    selectedPaws.clear();
    $('#pawSelection').classList.remove('warning');
    renderEditorLog();
    renderPawPicker();
  }
};

$('#editForm').onsubmit = async event => {
  event.preventDefault();
  document.querySelectorAll('[data-key]').forEach(input => editorDraft[input.dataset.key] = input.value);
  data = hydrate(editorDraft);
  await save();
  render();
  $('#editor').close();
};

$('#editBtn').onclick = () => openEditor();
$('#closeBtn').onclick = $('#cancelBtn').onclick = () => $('#editor').close();

$('#loginForm').onsubmit = async event => {
  event.preventDefault();
  $('#loginError').textContent = '';
  try {
    await signIn($('#email').value.trim(), $('#password').value);
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    await load();
  } catch (error) {
    $('#loginError').textContent = error.message === 'Invalid login credentials' ? 'E-Mail oder Passwort stimmt nicht.' : error.message;
  }
};

$('#logoutBtn').onclick = () => {
  localStorage.removeItem(STORE);
  session = null;
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
};

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
});

$('#installBtn').onclick = async () => {
  if (installPrompt) {
    await installPrompt.prompt();
    installPrompt = null;
  } else {
    alert('iPhone/iPad: In Safari auf „Teilen“ und dann „Zum Home-Bildschirm“ tippen.');
  }
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

(async () => {
  try { session = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { /* leer */ }
  if (session && await refresh()) {
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    await load();
  } else {
    localStorage.removeItem(STORE);
  }
})();

setInterval(async () => {
  if (!session || document.hidden) return;
  try {
    const response = await fetch(STATE_URL + '&select=data', { headers: headers(), cache: 'no-store' });
    const rows = await response.json();
    const raw = rows[0]?.data;
    const next = JSON.stringify(raw || {});
    if (raw && next !== lastCloud) {
      data = hydrate(raw);
      lastCloud = next;
      render();
    }
  } catch { /* Beim nächsten Intervall erneut versuchen. */ }
}, 3000);

