const API = window.location.origin + '/api/v1';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(API + path, opts).then(r => {
    if (r.status === 204) return null;
    if (!r.ok) return r.json().then(j => { throw new Error(j.detail || r.statusText); });
    return r.json();
  });
}

const tabs = {
  dashboard: renderDashboard,
  exercises: renderExercises,
  templates: renderTemplates,
  history: renderHistory,
};

function nav() {
  $$('nav button').forEach(btn => {
    btn.onclick = () => {
      $$('nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tabs[btn.dataset.tab]();
    };
  });
}

function card(title, html) {
  return `<div class="card"><h2>${title}</h2>${html}</div>`;
}

async function renderDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const [templates, workouts] = await Promise.all([
    api('GET', '/workout-templates'),
    api('GET', '/workouts?date=' + today)
  ]);
  const active = templates.find(t => t.is_active);
  let html = '';
  if (active) {
    html += card('Heute vorgeschlagen: ' + active.name,
      `<button onclick="startWorkout(${active.id}, '${active.name.replace(/'/g, "\\'")}')">Training starten</button>`);
  }
  if (workouts.length) {
    html += card('Aktive Einheiten heute', workouts.map(w =>
      `<div class="list-item"><span>${w.name}</span><button onclick="openWorkout(${w.id})">Öffnen</button></div>`).join(''));
  } else {
    html += card('Kein Training heute', '<span class="small">Starte ein Training aus einem aktiven Plan.</span>');
  }
  $('#app').innerHTML = html;
}

window.startWorkout = async (templateId, name) => {
  const today = new Date().toISOString().split('T')[0];
  const w = await api('POST', '/workouts', { workout_template_id: templateId, name, date: today });
  openWorkout(w.id);
};

window.openWorkout = async (id) => {
  const [w, exercises] = await Promise.all([
    api('GET', `/workouts/${id}`),
    api('GET', '/exercises')
  ]);
  let html = card(`${w.name} <span class="small">(${w.date})</span>`, `
    <div class="row">
      <button onclick="completeWorkout(${id})">Abschließen</button>
      <button class="danger" onclick="deleteWorkout(${id})">Löschen</button>
    </div>
    <div id="sets"></div>
    <hr>
    <h3>Satz hinzufügen</h3>
    <div class="row">
      <select id="exerciseSelect">${exercises.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}</select>
      <input id="setNumber" type="number" placeholder="Satz" value="1">
      <input id="reps" type="number" placeholder="Reps">
      <input id="weight" type="number" step="0.25" placeholder="kg">
      <input id="rpe" type="number" min="1" max="10" placeholder="RPE">
      <button onclick="addSet(${id})">+</button>
    </div>
  `);
  $('#app').innerHTML = html;
  renderSets(w);
};

function renderSets(w) {
  const byEx = {};
  w.sets.forEach(s => { byEx[s.exercise_id] = byEx[s.exercise_id] || []; byEx[s.exercise_id].push(s); });
  let html = '';
  for (const exId in byEx) {
    const sets = byEx[exId];
    html += `<div class="exercise-block"><h3>${sets[0].exercise_name}</h3>` +
      sets.map((s, i) => `<div class="set-row">
        <span>Satz ${s.set_number}</span>
        <input value="${s.weight_kg ?? ''}" onchange="updateSet(${w.id}, ${s.id}, 'weight_kg', this.value)">
        <span>kg ×</span>
        <input value="${s.reps ?? ''}" onchange="updateSet(${w.id}, ${s.id}, 'reps', this.value)">
        <span>@RPE</span>
        <input value="${s.rpe ?? ''}" onchange="updateSet(${w.id}, ${s.id}, 'rpe', this.value)">
        <button class="danger" onclick="deleteSet(${w.id}, ${s.id})">×</button>
      </div>`).join('') + '</div>';
  }
  $('#sets').innerHTML = html || '<span class="small">Noch keine Sätze.</span>';
}

window.addSet = async (workoutId) => {
  const payload = {
    exercise_id: parseInt($('#exerciseSelect').value),
    set_number: parseInt($('#setNumber').value) || 1,
    reps: parseInt($('#reps').value) || 0,
    weight_kg: $('#weight').value ? parseFloat($('#weight').value) : null,
    rpe: $('#rpe').value ? parseInt($('#rpe').value) : null
  };
  await api('POST', `/workouts/${workoutId}/sets`, payload);
  openWorkout(workoutId);
};

window.updateSet = async (workoutId, setId, field, value) => {
  const payload = { [field]: value === '' ? null : (field === 'reps' || field === 'rpe' ? parseInt(value) : parseFloat(value)) };
  await api('PATCH', `/workouts/${workoutId}/sets/${setId}`, payload);
};

window.deleteSet = async (workoutId, setId) => {
  await api('DELETE', `/workouts/${workoutId}/sets/${setId}`);
  openWorkout(workoutId);
};

window.completeWorkout = async (id) => {
  await api('PATCH', `/workouts/${id}`, { completed: true });
  renderDashboard();
};

window.deleteWorkout = async (id) => {
  if (!confirm('Training löschen?')) return;
  await api('DELETE', `/workouts/${id}`);
  renderDashboard();
};

async function renderExercises() {
  const exercises = await api('GET', '/exercises');
  let html = card('Neue Übung', `
    <input id="exName" placeholder="Name">
    <input id="exCategory" placeholder="Kategorie">
    <input id="exEquipment" placeholder="Equipment">
    <input id="exMuscle" placeholder="Muskelgruppe">
    <button onclick="createExercise()">Speichern</button>
  `);
  html += card('Übungen', exercises.map(e =>
    `<div class="list-item">
      <div><strong>${e.name}</strong><br><span class="small">${e.category || ''} ${e.equipment ? '· ' + e.equipment : ''}</span></div>
      <div><button onclick="viewExercise(${e.id})">History/PRs</button></div>
    </div>`).join(''));
  $('#app').innerHTML = html;
}

window.createExercise = async () => {
  const payload = {
    name: $('#exName').value,
    category: $('#exCategory').value,
    equipment: $('#exEquipment').value,
    muscle_group: $('#exMuscle').value
  };
  await api('POST', '/exercises', payload);
  renderExercises();
};

window.viewExercise = async (id) => {
  const [history, prs] = await Promise.all([
    api('GET', `/exercises/${id}/history`),
    api('GET', `/exercises/${id}/prs`)
  ]);
  const histRows = history.slice(0, 10).map(h =>
    `<tr><td>${h.date}</td><td>${h.set_number}</td><td>${h.weight_kg} kg</td><td>${h.reps}</td><td>${h.rpe ?? '-'}</td></tr>`).join('');
  $('#app').innerHTML = card('PRs', `
    <p>Max Gewicht: <strong>${prs.max_weight_kg ?? '-'} kg</strong></p>
    <p>Max Volumen (Satz): <strong>${prs.max_volume_set_kg ?? '-'} kg</strong></p>
  `) + card('Letzte Sätze', `<table width="100%">${histRows}</table>`);
};

async function renderTemplates() {
  const [templates, exercises] = await Promise.all([
    api('GET', '/workout-templates'),
    api('GET', '/exercises')
  ]);
  let html = card('Neuer Plan', `
    <input id="tplName" placeholder="Planname">
    <input id="tplDesc" placeholder="Beschreibung">
    <button onclick="createTemplate()">Anlegen</button>
  `);
  html += card('Pläne', templates.map(t =>
    `<div class="list-item">
      <div><strong>${t.name}</strong> ${t.is_active ? '<span class="success">● aktiv</span>' : ''}<br>
      <span class="small">${t.exercises.length} Übungen</span></div>
      <div><button onclick="viewTemplate(${t.id})">Bearbeiten</button></div>
    </div>`).join(''));
  $('#app').innerHTML = html;
}

window.createTemplate = async () => {
  await api('POST', '/workout-templates', { name: $('#tplName').value, description: $('#tplDesc').value });
  renderTemplates();
};

window.viewTemplate = async (id) => {
  const [t, exercises] = await Promise.all([
    api('GET', `/workout-templates/${id}`),
    api('GET', '/exercises')
  ]);
  let html = card(t.name, `
    <div class="row">
      <button onclick="activateTemplate(${id})">Aktiv setzen</button>
      <button class="danger" onclick="deleteTemplate(${id})">Löschen</button>
    </div>
    <h3>Übungen</h3>
    ${t.exercises.map(e => `<div class="list-item"><span>${e.exercise_name} — ${e.sets_target}×${e.reps_target}</span>
      <button class="danger" onclick="removeTplExercise(${id}, ${e.id})">×</button></div>`).join('')}
    <hr>
    <h3>Übung hinzufügen</h3>
    <div class="row">
      <select id="tplEx">${exercises.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}</select>
      <input id="tplSets" type="number" value="3" placeholder="Sätze">
      <input id="tplReps" placeholder="Reps (z.B. 8-12)">
      <input id="tplWeight" type="number" placeholder="kg Vorschlag">
      <input id="tplOrder" type="number" value="1" placeholder="Reihenfolge">
      <button onclick="addTplExercise(${id})">+</button>
    </div>
  `);
  $('#app').innerHTML = html;
};

window.activateTemplate = async (id) => { await api('POST', `/workout-templates/${id}/activate`); renderTemplates(); };
window.deleteTemplate = async (id) => { if (confirm('Plan löschen?')) { await api('DELETE', `/workout-templates/${id}`); renderTemplates(); } };
window.addTplExercise = async (id) => {
  await api('POST', `/workout-templates/${id}/exercises`, {
    exercise_id: parseInt($('#tplEx').value),
    sets_target: parseInt($('#tplSets').value),
    reps_target: $('#tplReps').value,
    weight_default: $('#tplWeight').value ? parseFloat($('#tplWeight').value) : null,
    order_index: parseInt($('#tplOrder').value)
  });
  viewTemplate(id);
};
window.removeTplExercise = async (tplId, entryId) => { await api('DELETE', `/workout-templates/${tplId}/exercises/${entryId}`); viewTemplate(tplId); };

async function renderHistory() {
  const workouts = await api('GET', '/workouts');
  const items = await Promise.all(workouts.map(async w => {
    const sum = await api('GET', `/workouts/${w.id}/summary`);
    return { w, sum };
  }));
  $('#app').innerHTML = card('Trainingshistorie', items.map(({w, sum}) =>
    `<div class="list-item">
      <div><strong>${w.name}</strong> <span class="small">${w.date}</span><br>
      <span class="small">${sum.total_sets} Sätze · ${sum.total_reps} Reps · ${sum.total_volume_kg} kg</span></div>
      <div><button onclick="openWorkout(${w.id})">Öffnen</button></div>
    </div>`).join(''));
}

nav();
renderDashboard();
