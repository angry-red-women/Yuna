const SUPABASE_URL = 'https://uoqastprrdlwlsesheoz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vCRrqr_Zi1Zg1jN-LOrV3Q_7I0LnzKu';
const STORE = 'yunaAuth';
const STATE_URL = SUPABASE_URL + '/rest/v1/yuna_state?id=eq.family';
const EDITOR_URL = SUPABASE_URL + '/rest/v1/yuna_editors?select=user_id&user_id=eq.';
const RESET_REDIRECT = location.origin + location.pathname + '?reset=1';

const pawMeta = [
  { key: 'frontLeft', label: 'Vorne links', side: 'Yunas linke Seite', position: 'lower-right' },
  { key: 'frontRight', label: 'Vorne rechts', side: 'Yunas rechte Seite', position: 'lower-left' },
  { key: 'hindLeft', label: 'Hinten links', side: 'Yunas linke Seite', position: 'upper-right' },
  { key: 'hindRight', label: 'Hinten rechts', side: 'Yunas rechte Seite', position: 'upper-left' }
];

const euTravelCountries = new Set([
  'Belgien', 'Bulgarien', 'Dänemark', 'Deutschland', 'Estland', 'Finnland', 'Frankreich',
  'Griechenland', 'Irland', 'Italien', 'Kroatien', 'Lettland', 'Litauen', 'Luxemburg',
  'Malta', 'Niederlande', 'Österreich', 'Polen', 'Portugal', 'Rumänien', 'Schweden',
  'Slowakei', 'Slowenien', 'Spanien', 'Tschechien', 'Ungarn', 'Zypern'
]);
const passportTravelCountries = new Set(['Andorra', 'Liechtenstein', 'Monaco', 'San Marino', 'Vatikanstadt']);
const tapewormCountries = new Set(['Finnland', 'Irland', 'Malta', 'Norwegen', 'Nordirland']);
const europeanCountries = [
  'Albanien', 'Andorra', 'Armenien', 'Aserbaidschan', 'Belarus', 'Belgien',
  'Bosnien und Herzegowina', 'Bulgarien', 'Dänemark', 'Deutschland', 'Estland',
  'Färöer', 'Finnland', 'Frankreich', 'Georgien', 'Griechenland', 'Grönland',
  'Irland', 'Island', 'Italien', 'Kosovo', 'Kroatien', 'Lettland', 'Liechtenstein',
  'Litauen', 'Luxemburg', 'Malta', 'Moldau', 'Monaco', 'Montenegro', 'Niederlande',
  'Nordirland', 'Nordmazedonien', 'Norwegen', 'Österreich', 'Polen', 'Portugal',
  'Rumänien', 'Russland', 'San Marino', 'Schweden', 'Serbien', 'Slowakei',
  'Slowenien', 'Spanien', 'Tschechien', 'Türkei', 'Ukraine', 'Ungarn',
  'Vatikanstadt', 'Vereinigtes Königreich (Grossbritannien)', 'Zypern'
];
const travelSources = {
  eu: 'https://europa.eu/youreurope/citizens/travel/carry/pets-and-other-animals/index_de.htm',
  blv: 'https://www.blv.admin.ch/de/reisen-heimtiere-hunde-katzen-frettchen',
  check: 'https://kwk.blv.admin.ch/kwk/de/home',
  uk: 'https://www.gov.uk/bring-your-pet-to-great-britain',
  iceland: 'https://www.mast.is/en/import-export/import-of-live-animals'
};

// Private Angaben stehen ausschliesslich in Supabase und nicht im öffentlichen GitHub-Code.
const initial = {
  paws: { 'Vorne links': '', 'Vorne rechts': '', 'Hinten links': '', 'Hinten rechts': '' },
  pawCareLog: [], heat: '', milk: '', vaccine: '', vaccineNext: '', vaccineName: '',
  rabiesVaccine: '', rabiesVaccineValidFrom: '', rabiesVaccineNext: '', rabiesVaccineName: '', tick: '', tickName: '',
  tickSpring: '', tickAutumn: '', worming: '', wormingNext: '', wormingIntervalMonths: 3, barfAmount: '',
  travelFoodAmount: '', foodTimes: '', vetName: '', vetAddress: '', vetPhone: '',
  emergencyVetName: '', emergencyVetAddress: '', emergencyVetPhone: '', reminder: '', notes: '',
  passportNumber: '', officialName: '', species: '', breed: '', sex: '', birthDate: '', color: '',
  chipNumber: '', chipDate: '', chipLocation: '', passportAmicusPhone: '', passportAmicusEmail: '', passportAmicusSite: '',
  passportIssuer: '', passportIssuerClinic: '', passportIssuerAddress: '', passportIssuerPhone: '', passportIssuerEmail: '', passportIssueDate: ''
};

let session = null;
let canEdit = false;
let installPrompt = null;
let data = structuredClone(initial);
let lastCloud = '';
let editorDraft = null;
let selectedPaws = new Set();
let openPawHistory = null;
let selectedTravelCountry = '';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const fmt = date => date
  ? new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date + 'T12:00:00'))
  : 'Noch offen';
const today = () => new Date().toLocaleDateString('sv-SE');
const addMonths = (date, months) => {
  if (!date) return '';
  const value = new Date(date + 'T12:00:00');
  value.setMonth(value.getMonth() + months);
  return value.toLocaleDateString('sv-SE');
};
const addMonthsAndDays = (date, months, days) => {
  const monthDate = addMonths(date, months);
  if (!monthDate) return '';
  const value = new Date(monthDate + 'T12:00:00');
  value.setDate(value.getDate() + days);
  return value.toLocaleDateString('sv-SE');
};
const dueState = date => !date ? 'unknown' : date <= today() ? 'due' : 'ok';
const statusText = state => state === 'ok' ? 'Aktuell in Ordnung' : state === 'due' ? 'Fällig – bitte prüfen' : 'Fälligkeit noch offen';
const telHref = value => `tel:${String(value || '').replace(/[^+\d]/g, '')}`;
const mapEmbedHref = address => `https://www.google.com/maps?q=${encodeURIComponent(address || '')}&output=embed`;
const mapRouteHref = (name, address) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${name || ''}, ${address || ''}`)}&travelmode=driving`;
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

async function requestPasswordReset(email) {
  const response = await fetch(SUPABASE_URL + '/auth/v1/recover?redirect_to=' + encodeURIComponent(RESET_REDIRECT), {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw Error(result.msg || result.message || 'Der Wiederherstellungslink konnte nicht gesendet werden.');
  }
}

function recoverySession() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.get('type') !== 'recovery' || !params.get('access_token')) return null;
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token') || '',
    token_type: params.get('token_type') || 'bearer'
  };
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

async function loadPermissions() {
  canEdit = false;
  if (session?.user?.id) {
    const response = await fetch(EDITOR_URL + encodeURIComponent(session.user.id), {
      headers: headers(), cache: 'no-store'
    });
    if (response.ok) canEdit = (await response.json()).length > 0;
  }
  $('#editBtn').classList.toggle('hidden', !canEdit);
  render();
}

async function save() {
  if (!canEdit) throw Error('Dieses Konto hat nur Leserechte.');
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

const editButton = (section, label = 'Ändern') => canEdit
  ? `<button type="button" class="card-edit" data-edit-section="${section}">✎ ${label}</button>`
  : '';

function info(icon, title, main, sub, dueDate = '', section = '') {
  const state = dueState(dueDate);
  return `<article class="info status-${state}">${editButton(section)}<div class="icon">${icon}</div><h3>${title}</h3><p>${esc(sub)}</p><strong>${esc(main)}</strong><span class="status-label">${statusText(state)}</span></article>`;
}

function reminder(title, date, section) {
  const state = dueState(date);
  return `<div class="reminder status-${state}">${editButton(section)}<b>📅 ${title}</b><span>${fmt(date)}</span><span class="status-label">${statusText(state)}</span></div>`;
}

function singlePawIcon() {
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="41" rx="18" ry="15"/><ellipse cx="13" cy="25" rx="7" ry="10" transform="rotate(-24 13 25)"/><ellipse cx="26" cy="14" rx="7" ry="10"/><ellipse cx="40" cy="14" rx="7" ry="10"/><ellipse cx="52" cy="25" rx="7" ry="10" transform="rotate(24 52 25)"/></svg>';
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
      : `data-main-paw="${paw.key}" aria-expanded="${chosen}" aria-controls="pawHistoryDropdown"`;
    return `<button type="button" class="map-paw ${paw.position}${chosen ? ' selected' : ''}" ${attribute} aria-label="${paw.label}: ${interactive ? 'auswählen' : 'Verlauf anzeigen'}">
      <span class="paw-print">${singlePawIcon()}</span><b>${paw.label}</b><small>${interactive ? paw.side : fmt(latestForPaw(target, paw.key))}</small>
    </button>`;
  }).join('');

  return `<div class="dog-map${interactive ? ' edit-map' : ''}">
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

function pawHistoryDropdown(key) {
  if (!key) return '';
  const paw = pawMeta.find(item => item.key === key);
  const entries = sortedLog(data).filter(entry => entry.paws.includes(key));
  const rows = entries.length
    ? entries.map(entry => `<li><time datetime="${esc(entry.date)}">${fmt(entry.date)}</time><span>${esc(entry.action || 'Geschliffen')}</span></li>`).join('')
    : '<li class="empty-log">Für diese Pfote gibt es noch keinen Eintrag.</li>';
  return `<section id="pawHistoryDropdown" class="paw-dropdown" aria-live="polite">
    <div class="paw-dropdown-head"><div><span>Historie</span><h3>${esc(paw.label)}</h3></div><button type="button" class="primary small-button" data-add-for-paw="${paw.key}">+ Neuer Termin</button></div>
    <ol>${rows}</ol>
  </section>`;
}

function travelRules(country) {
  const base = [
    ['Mikrochip', 'Der Chip muss vor der gültigen Tollwutimpfung gesetzt worden sein.'],
    ['Tollwutimpfung', 'Muss am Reisetag gültig sein. Nach einer Erstimpfung gelten mindestens 21 Tage Wartezeit.'],
    ['Heimtierpass', 'Original des gültigen Schweizer Heimtierpasses mitführen.'],
    ['Private Reise', 'Yuna reist mit euch oder einer bevollmächtigten Person; höchstens fünf Heimtiere.']
  ];
  if (country === 'Island') return {
    status: 'Quarantäne und Importbewilligung erforderlich', tone: 'danger', source: travelSources.iceland,
    items: [...base, ['Einfuhrbewilligung', 'Vor der Reise bei der isländischen Veterinärbehörde MAST beantragen.'], ['Gesundheitstests', 'Zusätzliche Impfungen, Untersuchungen und Fristen nach MAST-Vorgaben einplanen.'], ['Quarantäne', 'Nach aktueller Behördeninformation sind zwei Wochen Quarantäne nach Ankunft vorgeschrieben.']]
  };
  if (country === 'Vereinigtes Königreich (Grossbritannien)') return {
    status: 'Keine Quarantäne bei vollständig erfüllten Bedingungen', tone: 'special', source: travelSources.uk,
    items: [...base, ['Bandwurmbehandlung', 'Tierärztlich 24–120 Stunden vor Einreise; Präparat, Datum, Uhrzeit, Stempel und Unterschrift im Pass.'], ['Reiseroute', 'Nur zugelassene Transportfirma und zugelassene Einreiseroute verwenden.']]
  };
  if (euTravelCountries.has(country) || passportTravelCountries.has(country) || country === 'Norwegen' || country === 'Nordirland') {
    const items = [...base];
    if (tapewormCountries.has(country)) items.push(['Bandwurmbehandlung', 'Tierärztlich 24–120 Stunden vor Einreise gegen Echinococcus multilocularis; vollständig im Pass dokumentieren.']);
    return {status: 'Keine planmässige Quarantäne bei gültigen Unterlagen', tone: tapewormCountries.has(country) ? 'special' : 'ok', source: travelSources.eu, items};
  }
  return {
    status: 'Sonderregeln vor jeder Reise amtlich prüfen', tone: 'warning', source: travelSources.check,
    items: [...base, ['Gesundheitszeugnis / Bewilligung', 'Kann je nach Zielland, Route und Aufenthaltsdauer verlangt werden.'], ['Rückreise in die Schweiz', 'Bei Tollwut-Risikoländern können Antikörpertest, längere Fristen und eine Einreisekontrolle nötig sein. Reise-Check vor der Buchung durchführen.']]
  };
}

function renderTravel() {
  const options = europeanCountries.map(country => `<option${country === selectedTravelCountry ? ' selected' : ''}>${esc(country)}</option>`).join('');
  if (!selectedTravelCountry) {
    $('#travel').innerHTML = `<div class="travel-intro"><div><span class="travel-icon">🧳</span><h3>Einreise-Check ab der Schweiz</h3><p>Zielland wählen und Yunas erforderliche Unterlagen sowie Sonderregeln anzeigen.</p></div><label>Zielland<select id="travelCountry"><option value="">Land auswählen …</option>${options}</select></label></div><p class="travel-note">Die Angaben gelten für eine private Ferienreise mit Rückkehr in die Schweiz. Letzte amtliche Prüfung: 7. September 2026.</p>`;
    return;
  }
  const rules = travelRules(selectedTravelCountry);
  const items = rules.items.map(([title, text]) => `<li><span>✓</span><div><b>${esc(title)}</b><p>${esc(text)}</p></div></li>`).join('');
  $('#travel').innerHTML = `<div class="travel-intro"><div><span class="travel-icon">🧳</span><h3>Einreise nach ${esc(selectedTravelCountry)}</h3><p>Abreise und Rückreise: Schweiz</p></div><label>Zielland<select id="travelCountry"><option value="">Land auswählen …</option>${options}</select></label></div><div class="travel-status ${rules.tone}">${esc(rules.status)}</div><ul class="travel-list">${items}</ul><div class="travel-links"><a href="${rules.source}" target="_blank" rel="noopener">Amtliche Regeln des Ziellands ↗</a><a href="${travelSources.blv}" target="_blank" rel="noopener">Rückreise in die Schweiz prüfen ↗</a></div><p class="travel-note">Kurz vor jeder Buchung nochmals die amtliche Quelle öffnen. Fehlende Unterlagen können zur Zurückweisung oder Quarantäne führen. Letzte amtliche Prüfung: 7. September 2026.</p>`;
}

function render() {
  const simparica = /simparica/i.test(data.tickName || '');
  const tickDue = simparica ? addMonthsAndDays(data.tick, 4, 15) : addMonths(data.tick, 1);
  const vaccineDue = data.vaccineNext || addMonths(data.vaccine, 12);
  const rabiesVaccineDue = data.rabiesVaccineNext || '';
  const nextVaccination = [vaccineDue, rabiesVaccineDue].filter(Boolean).sort()[0] || '';
  const nextVaccinationSection = nextVaccination === rabiesVaccineDue ? 'rabiesVaccine' : 'vaccine';
  const rabiesStatusDate = data.rabiesVaccine && rabiesVaccineDue ? rabiesVaccineDue : today();
  const heatDue = addMonths(data.heat, 6);
  const healthNeedsAttention = [tickDue, vaccineDue, rabiesStatusDate, data.wormingNext, heatDue]
    .some(date => dueState(date) !== 'ok');
  const hero = $('.hero');
  hero.classList.toggle('needs-attention', healthNeedsAttention);
  hero.querySelector('h1').textContent = healthNeedsAttention ? 'Bei Yuna ist etwas zu prüfen.' : 'Alles gut bei Yuna.';
  hero.querySelector('p').textContent = healthNeedsAttention
    ? 'Mindestens eine Gesundheitsangabe fehlt oder ist fällig. Die rötliche Kachel zeigt, worum es geht.'
    : 'Pflege, Gesundheit und Ferieninfos an einem Ort – damit alle wissen, was Yuna gerade braucht.';
  $('#health').innerHTML =
    info('🛡️', 'Zeckenschutz', data.tickName || 'Noch offen', `Verabreicht: ${fmt(data.tick)} · ${simparica ? 'Für Yuna angenommene Wirkung (4½ Monate)' : 'Wirkung ungefähr'} bis: ${fmt(tickDue)} · Saison-Erinnerung: ${fmt(data.tickSpring)}`, tickDue, 'tick') +
    info('💉', 'Kombiimpfung', data.vaccineName || 'Kombiimpfung', `Gemacht: ${fmt(data.vaccine)} · Erneuern: ${fmt(vaccineDue)}`, vaccineDue, 'vaccine') +
    info('💉', 'Tollwutimpfung', data.rabiesVaccineName || 'Tollwutimpfung', `Gemacht: ${fmt(data.rabiesVaccine)} · Gültig ab: ${fmt(data.rabiesVaccineValidFrom)} · Gültig bis: ${fmt(rabiesVaccineDue)}`, rabiesStatusDate, 'rabiesVaccine') +
    info('〰️', 'Entwurmung', `Nächste: ${fmt(data.wormingNext)}`, `Zuletzt: ${fmt(data.worming)}`, data.wormingNext, 'worming') +
    info('♡', 'Läufigkeit & Milcheinschuss', fmt(data.heat), `${data.milk ? `Milcheinschuss: ${fmt(data.milk)} · ` : ''}Nächste Läufigkeit ungefähr ab ${fmt(heatDue)}`, heatDue, 'heat');

  const openSelection = openPawHistory ? new Set([openPawHistory]) : new Set();
  $('#paws').innerHTML = `<div class="card-head"><div class="paw-map-copy"><h3>Pfote direkt antippen</h3><p>Wähle eine Pfote in der Zeichnung. Darunter klappt ihre persönliche Schleif-Historie auf.</p></div>${editButton('paws', 'Pflege eintragen')}</div>${dogMap(data, false, openSelection)}${pawHistoryDropdown(openPawHistory)}`;
  $('#reminders').innerHTML = reminder('Nächste Impfung', nextVaccination, nextVaccinationSection) + reminder('Zeckenschutz Frühling', data.tickSpring, 'tickSpring') + reminder('Zeckenschutz Spätsommer', data.tickAutumn, 'tickAutumn');
  renderTravel();
  $('#food').innerHTML = `<div class="card-head"><h3>🦴 Futter</h3>${editButton('food')}</div><div class="food-block"><span class="pill">Zuhause · BARF</span><strong>2 × ${esc(data.barfAmount || '–')}</strong><p>Jeweils ${esc(data.barfAmount || '–')} am Morgen und ${esc(data.barfAmount || '–')} am Abend</p></div><div class="food-block"><span class="pill">Reise · Nassfutter</span><strong>2 × ${esc(data.travelFoodAmount || '–')}</strong><p>Jeweils ${esc(data.travelFoodAmount || '–')} am Morgen und ${esc(data.travelFoodAmount || '–')} am Abend</p></div>`;
  $('#vet').innerHTML = `<h3>📍 Tierarzt</h3><div class="vet-block"><div class="card-head"><span class="pill">Tierärztin</span>${editButton('vet')}</div><b>${esc(data.vetName || 'Noch offen')}</b><p>${esc(data.vetAddress)}<br>${esc(data.vetPhone)}</p><iframe class="vet-map" title="Karte zur Tierärztin" src="${mapEmbedHref(data.vetAddress)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><div class="vet-actions"><a class="outline" href="${telHref(data.vetPhone)}">Tierärztin anrufen</a><a class="primary" href="${mapRouteHref(data.vetName, data.vetAddress)}" target="_blank" rel="noopener">Route mit dem Auto</a></div></div><div class="vet-block"><div class="card-head"><span class="pill">24-h-Notfall</span>${editButton('emergencyVet')}</div><b>${esc(data.emergencyVetName || 'Noch offen')}</b><p>${esc(data.emergencyVetAddress)}<br>${esc(data.emergencyVetPhone)}</p><iframe class="vet-map" title="Karte zur Notfallklinik" src="${mapEmbedHref(data.emergencyVetAddress)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><div class="vet-actions"><a class="outline" href="${telHref(data.emergencyVetPhone)}">Notfallklinik anrufen</a><a class="primary" href="${mapRouteHref(data.emergencyVetName, data.emergencyVetAddress)}" target="_blank" rel="noopener">Route mit dem Auto</a></div></div>`;
  $('#passport').innerHTML = `<div class="card-head"><h3>📘 Hundepass</h3>${editButton('passport')}</div><div class="passport-grid"><dl><dt>Passnummer</dt><dd class="passport-number">${esc(data.passportNumber || 'Noch offen')}</dd><dt>Offizieller Name</dt><dd>${esc(data.officialName || 'Noch offen')}</dd><dt>Geburtsdatum</dt><dd>${fmt(data.birthDate)}</dd></dl><dl><dt>Tier</dt><dd>${esc([data.species, data.breed, data.sex, data.color].filter(Boolean).join(' · ') || 'Noch offen')}</dd><dt>Mikrochip</dt><dd class="passport-number">${esc(data.chipNumber || 'Noch offen')}</dd><dt>Chip eingesetzt</dt><dd>${fmt(data.chipDate)}${data.chipLocation ? ` · ${esc(data.chipLocation)}` : ''}</dd></dl><dl class="passport-full"><dt>Amicus-Registrierung</dt><dd>${esc(data.passportAmicusPhone || 'Noch offen')} · ${esc(data.passportAmicusEmail || '')}<br>${esc(data.passportAmicusSite || '')}</dd></dl><dl class="passport-full"><dt>Ausgestellt von</dt><dd><b>${esc(data.passportIssuer || 'Noch offen')}</b><br>${esc(data.passportIssuerClinic || '')}<br>${esc(data.passportIssuerAddress || '')}<br>${esc(data.passportIssuerPhone || '')}${data.passportIssuerEmail ? ` · ${esc(data.passportIssuerEmail)}` : ''}<br>Ausgestellt am: ${fmt(data.passportIssueDate)}</dd></dl></div>`;
  $('#holiday').innerHTML = `<div class="card-head"><h3>Wichtig in den Ferien</h3>${editButton('holiday')}</div><p>${esc(data.notes || 'Noch keine Hinweise eingetragen.')}</p>`;
}

const fields = [
  ['heat', 'Letzte Läufigkeit', 'date'], ['milk', 'Milcheinschuss', 'date'],
  ['vaccine', 'Kombiimpfung gemacht am', 'date'], ['vaccineNext', 'Kombiimpfung erneuern am', 'date'], ['vaccineName', 'Kombiimpfung / Präparat'],
  ['rabiesVaccine', 'Tollwutimpfung gemacht am', 'date'], ['rabiesVaccineValidFrom', 'Tollwutimpfung gültig ab', 'date'], ['rabiesVaccineNext', 'Tollwutimpfung gültig bis', 'date'], ['rabiesVaccineName', 'Tollwutimpfung / Präparat'],
  ['tick', 'Zeckenschutz verabreicht am', 'date'], ['tickName', 'Zeckenmittel'],
  ['tickSpring', 'Zecken-Erinnerung Frühling', 'date'], ['tickAutumn', 'Zecken-Erinnerung Spätsommer', 'date'],
  ['worming', 'Letzte Entwurmung', 'date'], ['wormingIntervalMonths', 'Intervall Entwurmung (Monate)', 'number'], ['wormingNext', 'Nächste Entwurmung laut Produkt', 'date'],
  ['reminder', 'Nächster Termin gemäss Tierarzt', 'date'], ['barfAmount', 'BARF pro Mahlzeit'],
  ['travelFoodAmount', 'Nassfutter auf Reisen pro Mahlzeit'], ['foodTimes', 'Futterzeiten'],
  ['vetName', 'Tierärztin'], ['vetPhone', 'Telefon Tierärztin'], ['vetAddress', 'Adresse Tierärztin'],
  ['emergencyVetName', 'Notfallklinik'], ['emergencyVetPhone', 'Telefon Notfallklinik'], ['emergencyVetAddress', 'Adresse Notfallklinik'], ['notes', 'Ferienhinweise', 'textarea'],
  ['passportNumber', 'Passnummer'], ['officialName', 'Offizieller Name'], ['species', 'Tierart'], ['breed', 'Rasse'], ['sex', 'Geschlecht'], ['birthDate', 'Geburtsdatum', 'date'], ['color', 'Farbe'],
  ['chipNumber', 'Mikrochip-Nummer'], ['chipDate', 'Chip eingesetzt am', 'date'], ['chipLocation', 'Position des Chips'],
  ['passportAmicusPhone', 'Amicus Telefon'], ['passportAmicusEmail', 'Amicus E-Mail'], ['passportAmicusSite', 'Amicus Webseite'],
  ['passportIssuer', 'Pass ausgestellt von'], ['passportIssuerClinic', 'Ausstellende Praxis'], ['passportIssuerAddress', 'Adresse der Praxis'], ['passportIssuerPhone', 'Telefon der Praxis'], ['passportIssuerEmail', 'E-Mail der Praxis'], ['passportIssueDate', 'Pass ausgestellt am', 'date']
];

const fieldGroups = {
  tick: { title: 'Zeckenschutz ändern', keys: ['tick', 'tickName', 'tickSpring', 'tickAutumn'] },
  vaccine: { title: 'Kombiimpfung ändern', keys: ['vaccine', 'vaccineNext', 'vaccineName'] },
  rabiesVaccine: { title: 'Tollwutimpfung ändern', keys: ['rabiesVaccine', 'rabiesVaccineValidFrom', 'rabiesVaccineNext', 'rabiesVaccineName'] },
  worming: { title: 'Entwurmung ändern', keys: ['worming', 'wormingIntervalMonths', 'wormingNext'] },
  heat: { title: 'Läufigkeit & Milcheinschuss ändern', keys: ['heat', 'milk'] },
  reminder: { title: 'Tierarzt-Erinnerung ändern', keys: ['reminder'] },
  tickSpring: { title: 'Frühlings-Erinnerung ändern', keys: ['tickSpring'] },
  tickAutumn: { title: 'Spätsommer-Erinnerung ändern', keys: ['tickAutumn'] },
  food: { title: 'Futter ändern', keys: ['barfAmount', 'travelFoodAmount', 'foodTimes'] },
  vet: { title: 'Tierärztin ändern', keys: ['vetName', 'vetPhone', 'vetAddress'] },
  emergencyVet: { title: 'Notfallklinik ändern', keys: ['emergencyVetName', 'emergencyVetPhone', 'emergencyVetAddress'] },
  passport: { title: 'Hundepass ändern', keys: ['passportNumber', 'officialName', 'species', 'breed', 'sex', 'birthDate', 'color', 'chipNumber', 'chipDate', 'chipLocation', 'passportAmicusPhone', 'passportAmicusEmail', 'passportAmicusSite', 'passportIssuer', 'passportIssuerClinic', 'passportIssuerAddress', 'passportIssuerPhone', 'passportIssuerEmail', 'passportIssueDate'] },
  holiday: { title: 'Ferienhinweise ändern', keys: ['notes'] },
  paws: { title: 'Krallenpflege eintragen', keys: [] }
};

function renderPawPicker() {
  $('#pawPicker').innerHTML = dogMap(editorDraft, true, selectedPaws);
  const count = selectedPaws.size;
  $('#pawSelection').textContent = count ? `${count} ${count === 1 ? 'Pfote' : 'Pfoten'} ausgewählt` : 'Bitte Pfote(n) in der Zeichnung antippen';
}

function renderEditorLog() {
  const entries = sortedLog(editorDraft);
  $('#editorPawLog').innerHTML = entries.length ? entries.map(entry => logRow(entry, true)).join('') : '<p class="empty-log">Noch keine Einträge.</p>';
}

function openEditor(preselected = [], section = 'all') {
  if (!canEdit) return;
  editorDraft = structuredClone(data);
  selectedPaws = new Set(preselected);
  const essentialGroups = {
    tick: { title: 'Zeckenschutz ändern', keys: ['tick', 'tickName', 'tickSpring', 'tickAutumn'] },
    vaccine: { title: 'Kombiimpfung ändern', keys: ['vaccine', 'vaccineNext', 'vaccineName'] },
    rabiesVaccine: { title: 'Tollwutimpfung ändern', keys: ['rabiesVaccine', 'rabiesVaccineValidFrom', 'rabiesVaccineNext', 'rabiesVaccineName'] }
  };
  const group = essentialGroups[section] || fieldGroups[section];
  const includePaws = section === 'all' || section === 'paws';
  const instantPawMode = section === 'paws';
  $('#editor').dataset.section = section;
  $('#saveBtn').classList.toggle('hidden', instantPawMode);
  $('#cancelBtn').textContent = instantPawMode ? 'Schliessen' : 'Abbrechen';
  $('#editorTitle').textContent = group?.title || 'Yunas Angaben bearbeiten';
  const pawSection = includePaws ? `<section class="paw-edit-panel">
    <div><h3>Krallenpflege eintragen</h3><p>Schwanz oben, Kopf unten. Du kannst auch mehrere Pfoten für dasselbe Datum auswählen.</p></div>
    <div id="pawPicker"></div><p id="pawSelection" class="selection-note"></p>
    <div class="paw-entry-fields"><label>Datum<input id="pawDate" type="date" value="${today()}"></label><label>Pflege<select id="pawAction"><option>Geschliffen</option><option>Geschnitten</option></select></label><button id="addPawLog" type="button" class="primary">Eintrag hinzufügen</button></div>
    <h3 class="editor-log-title">Bisheriger Verlauf</h3><div id="editorPawLog" class="editor-log"></div>
  </section>` : '';
  const visibleFields = group ? fields.filter(([key]) => group.keys.includes(key)) : fields;
  const otherFields = visibleFields.map(([key, label, type = 'text']) => `<label>${label}${type === 'textarea'
    ? `<textarea data-key="${key}">${esc(editorDraft[key] || '')}</textarea>`
    : `<input data-key="${key}" type="${type}" value="${esc(editorDraft[key] || '')}">`}</label>`).join('');
  $('#fields').innerHTML = pawSection + otherFields;
  if (includePaws) {
    renderPawPicker();
    renderEditorLog();
  }
  $('#editor').showModal();
}

$('#paws').onclick = event => {
  const addButton = event.target.closest('[data-add-for-paw]');
  if (addButton) {
    openEditor([addButton.dataset.addForPaw], 'paws');
    return;
  }
  const button = event.target.closest('[data-main-paw]');
  if (button) {
    openPawHistory = openPawHistory === button.dataset.mainPaw ? null : button.dataset.mainPaw;
    render();
  }
};

document.addEventListener('click', event => {
  const passwordButton = event.target.closest('[data-password-target]');
  if (passwordButton) {
    const input = document.getElementById(passwordButton.dataset.passwordTarget);
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    passwordButton.textContent = visible ? '👁' : '🙈';
    passwordButton.setAttribute('aria-label', visible ? 'Passwort anzeigen' : 'Passwort verbergen');
    passwordButton.setAttribute('aria-pressed', String(!visible));
    return;
  }
  const button = event.target.closest('[data-edit-section]');
  if (button && canEdit) openEditor([], button.dataset.editSection);
});

$('#travel').onchange = event => {
  if (event.target.id !== 'travelCountry') return;
  selectedTravelCountry = event.target.value;
  renderTravel();
};

$('#fields').onclick = async event => {
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
    if ($('#editor').dataset.section === 'paws') {
      data = hydrate(editorDraft);
      await save();
      render();
    }
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
    if ($('#editor').dataset.section === 'paws') {
      data = hydrate(editorDraft);
      await save();
      render();
    }
  }
};

$('#fields').onchange = event => {
  if (!['worming', 'wormingIntervalMonths'].includes(event.target.dataset.key)) return;
  const lastInput = document.querySelector('[data-key="worming"]');
  const intervalInput = document.querySelector('[data-key="wormingIntervalMonths"]');
  const nextInput = document.querySelector('[data-key="wormingNext"]');
  const interval = Math.max(1, Number(intervalInput.value) || 3);
  const next = addMonths(lastInput.value, interval);
  intervalInput.value = String(interval);
  nextInput.value = next;
  editorDraft.worming = lastInput.value;
  editorDraft.wormingIntervalMonths = interval;
  editorDraft.wormingNext = next;
};

$('#editForm').onsubmit = async event => {
  event.preventDefault();
  document.querySelectorAll('[data-key]').forEach(input => editorDraft[input.dataset.key] = input.value);
  data = hydrate(editorDraft);
  await save();
  render();
  $('#editor').close();
};

$('#editBtn').onclick = () => { if (canEdit) openEditor(); };
$('#closeBtn').onclick = $('#cancelBtn').onclick = () => $('#editor').close();

$('#loginForm').onsubmit = async event => {
  event.preventDefault();
  $('#loginError').textContent = '';
  try {
    await signIn($('#email').value.trim(), $('#password').value);
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    await loadPermissions();
    await load();
  } catch (error) {
    $('#loginError').textContent = error.message === 'Invalid login credentials' ? 'E-Mail oder Passwort stimmt nicht.' : error.message;
  }
};

$('#forgotBtn').onclick = async () => {
  const email = $('#email').value.trim();
  $('#loginError').textContent = '';
  if (!email) {
    $('#loginError').textContent = 'Bitte zuerst die E-Mail-Adresse eingeben.';
    $('#email').focus();
    return;
  }
  try {
    await requestPasswordReset(email);
    $('#loginError').textContent = 'E-Mail gesendet. Bitte den Link im Posteingang öffnen.';
    $('#loginError').classList.add('success-message');
  } catch (error) {
    $('#loginError').classList.remove('success-message');
    $('#loginError').textContent = error.message;
  }
};

$('#passwordResetForm').onsubmit = async event => {
  event.preventDefault();
  const password = $('#newPassword').value;
  const repeated = $('#newPasswordRepeat').value;
  $('#passwordResetError').textContent = '';
  if (password !== repeated) {
    $('#passwordResetError').textContent = 'Die beiden Passwörter stimmen nicht überein.';
    return;
  }
  const response = await fetch(SUPABASE_URL + '/auth/v1/user', {
    method: 'PUT',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    $('#passwordResetError').textContent = result.msg || result.message || 'Das Passwort konnte nicht gespeichert werden.';
    return;
  }
  localStorage.removeItem(STORE);
  session = null;
  history.replaceState(null, '', location.pathname + '?v=13');
  $('#passwordReset').classList.add('hidden');
  $('#login').classList.remove('hidden');
  $('#loginError').classList.add('success-message');
  $('#loginError').textContent = 'Passwort geändert. Sie können sich jetzt anmelden.';
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
  const recovery = recoverySession();
  if (recovery) {
    session = recovery;
    $('#login').classList.add('hidden');
    $('#passwordReset').classList.remove('hidden');
    return;
  }
  try { session = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { /* leer */ }
  if (!session) return;

  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  try {
    await load();
    await loadPermissions();
  } catch {
    localStorage.removeItem(STORE);
    session = null;
    $('#app').classList.add('hidden');
    $('#login').classList.remove('hidden');
    $('#loginError').textContent = 'Die Anmeldung ist abgelaufen. Bitte einmal neu anmelden.';
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

