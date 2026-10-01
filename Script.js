// ---------- Data ----------
const PROGRAMS = [
  { id: 'ds',   name: 'B.Sc. Data Science',            minPercent: 60, groups: ['maths'],                     seats: 60,  desc: 'Statistics, Python, machine learning and databases.' },
  { id: 'cs',   name: 'B.Sc. Computer Science',        minPercent: 55, groups: ['maths'],                     seats: 90,  desc: 'Programming, algorithms, networks and software design.' },
  { id: 'bcom', name: 'B.Com (Computer Applications)', minPercent: 50, groups: ['commerce', 'maths'],         seats: 120, desc: 'Accounting, taxation and business computing.' },
  { id: 'eco',  name: 'B.A. Economics',                minPercent: 50, groups: ['maths', 'commerce', 'arts'], seats: 60,  desc: 'Micro and macro economics, public policy, econometrics.' },
  { id: 'bba',  name: 'BBA',                           minPercent: 50, groups: ['maths', 'commerce', 'arts'], seats: 60,  desc: 'Management, marketing, finance and entrepreneurship.' },
];
const GROUP_LABEL = { maths: 'Maths / Science', commerce: 'Commerce', arts: 'Arts / Humanities' };
const STORE_KEY = 'kcas_applications_v1';
const DRAFT_KEY = 'kcas_draft_v1';

// ---------- Helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const form = $('#admissionForm');
const steps = $$('.step');
const stepper = $$('#stepper li');
let current = 0;

const store = {
  read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
  },
  remove(key) { try { localStorage.removeItem(key); } catch {} }
};

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function getData() {
  const d = Object.fromEntries(new FormData(form).entries());
  d.program = (form.elements.program && form.elements.program.value) || '';
  return d;
}

// ---------- Programs section ----------
$('#programGrid').innerHTML = PROGRAMS.map(p => `
  <article class="program">
    <h3>${p.name}</h3>
    <p>${p.desc}</p>
    <p class="meta">Min. ${p.minPercent}% · ${p.seats} seats</p>
  </article>`).join('');

// ---------- Validation ----------
const rules = {
  fullName: v => /^[A-Za-z .'-]{3,}$/.test(v.trim()) || 'Enter your full name (letters only, at least 3 characters).',
  dob: v => {
    if (!v) return 'Select your date of birth.';
    const age = (Date.now() - new Date(v)) / (365.25 * 24 * 3600 * 1000);
    return (age >= 16 && age <= 30) || 'Applicants must be between 16 and 30 years old.';
  },
  gender: v => !!v || 'Select a gender.',
  phone: v => /^[6-9]\d{9}$/.test(v) || 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.',
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || 'Enter a valid email, like name@example.com.',
  city: v => v.trim().length >= 2 || 'Enter your city.',
  board: v => !!v || 'Select your 12th board.',
  year: v => (+v >= 2020 && +v <= 2027) || 'Enter a year between 2020 and 2027.',
  group: v => !!v || 'Select your 12th group.',
  percent: v => (v !== '' && +v >= 0 && +v <= 100) || 'Enter a percentage between 0 and 100.',
  school: v => v.trim().length >= 3 || 'Enter your school name.',
};

function setError(input, msg) {
  const wrap = input.closest('.field');
  if (!wrap) return;
  wrap.classList.toggle('invalid', !!msg);
  $('.error', wrap).textContent = msg || '';
}

function validateStep(i) {
  let ok = true;
  const data = getData();

  if (i === 0 || i === 1) {
    $$('input, select', steps[i]).forEach(el => {
      const rule = rules[el.name];
      if (!rule) return;
      const res = rule(el.value);
      if (res !== true) { setError(el, res); ok = false; } else setError(el, '');
    });
  }
  if (i === 2) {
    const err = $('#programError');
    if (!data.program) { err.textContent = 'Choose a program to continue.'; ok = false; }
    else err.textContent = '';
  }
  if (i === 3) {
    const err = $('#declareError');
    if (!form.elements.declare.checked) { err.textContent = 'Tick the box to confirm your details.'; ok = false; }
    else err.textContent = '';
  }
  if (!ok) { const bad = $('.invalid input, .invalid select', steps[i]); if (bad) bad.focus(); }
  return ok;
}

// live clear errors
form.addEventListener('input', e => {
  const rule = rules[e.target.name];
  if (rule && e.target.closest('.field.invalid') && rule(e.target.value) === true) setError(e.target, '');
  if (e.target.name === 'phone') e.target.value = e.target.value.replace(/\D/g, '');
  saveDraft();
});

// ---------- Program choices (eligibility) ----------
function renderChoices() {
  const { group, percent } = getData();
  const program = getData().program || form.dataset.program || '';
  $('#programChoices').innerHTML = PROGRAMS.map(p => {
    let reason = '';
    if (!p.groups.includes(group)) reason = `Needs 12th in ${p.groups.map(g => GROUP_LABEL[g]).join(' or ')}.`;
    else if (+percent < p.minPercent) reason = `Needs at least ${p.minPercent}% in 12th (you entered ${percent}%).`;
    const disabled = !!reason;
    return `
      <label class="choice ${disabled ? 'disabled' : ''}">
        <input type="radio" name="program" value="${p.id}" ${disabled ? 'disabled' : ''} ${program === p.id && !disabled ? 'checked' : ''}>
        <div><strong>${p.name}</strong>
          <span>${p.desc} Minimum ${p.minPercent}%.</span>
          ${disabled ? `<span class="why"><br>${reason}</span>` : ''}
        </div>
      </label>`;
  }).join('');
}

// ---------- Review ----------
function renderReview() {
  const d = getData();
  const prog = PROGRAMS.find(p => p.id === d.program);
  const rows = [
    ['Name', d.fullName], ['Date of birth', d.dob], ['Gender', d.gender],
    ['Mobile', d.phone], ['Email', d.email], ['City', d.city],
    ['School', d.school], ['Board', `${d.board}, ${d.year}`],
    ['12th group', GROUP_LABEL[d.group]], ['12th percentage', d.percent + '%'],
    ['Program', prog ? prog.name : '-'],
  ];
  $('#reviewList').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v || '-')}</dd>`).join('');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Navigation ----------
function showStep(i) {
  current = i;
  steps.forEach((s, idx) => s.classList.toggle('active', idx === i));
  stepper.forEach((s, idx) => {
    s.classList.toggle('active', idx === i);
    s.classList.toggle('done', idx < i);
  });
  $('#backBtn').hidden = i === 0;
  $('#nextBtn').textContent = i === steps.length - 1 ? 'Submit application' : 'Continue';
  if (i === 2) renderChoices();
  if (i === 3) renderReview();
  $('#stepper').scrollIntoView({ block: 'nearest' });
}

$('#nextBtn').addEventListener('click', () => {
  if (!validateStep(current)) return;
  if (current < steps.length - 1) { showStep(current + 1); saveDraft(); }
  else submitApplication();
});
$('#backBtn').addEventListener('click', () => showStep(current - 1));
form.addEventListener('submit', e => e.preventDefault());

// ---------- Draft save ----------
function saveDraft() {
  const d = getData();
  delete d.declare;
  store.write(DRAFT_KEY, { data: d, step: current });
}
function loadDraft() {
  const draft = store.read(DRAFT_KEY, null);
  if (!draft) return;
  Object.entries(draft.data).forEach(([k, v]) => {
    const el = form.elements[k];
    if (el && el.type !== 'radio' && el.type !== 'checkbox') el.value = v;
  });
  if (draft.data.program) form.dataset.program = draft.data.program;
  if (draft.step) { showStep(Math.min(draft.step, 2)); toast('Draft restored'); }
}

// ---------- Submit ----------
function makeId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'KCAS26-' + s;
}

function submitApplication() {
  if (!validateStep(3)) return;
  const d = getData();
  delete d.declare;
  const apps = store.read(STORE_KEY, {});
  let id;
  do { id = makeId(); } while (apps[id]);
  apps[id] = { ...d, id, submittedAt: Date.now() };
  store.write(STORE_KEY, apps);
  store.remove(DRAFT_KEY);

  form.hidden = true;
  $('#stepper').hidden = true;
  $('#appId').textContent = id;
  const box = $('#successBox');
  box.hidden = false;
  box.focus();
  $('#trackInput').value = id;
}

$('#copyBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#appId').textContent); toast('Application ID copied'); }
  catch { toast('Copy failed. Select the ID and copy it manually.'); }
});

$('#newBtn').addEventListener('click', () => {
  form.reset();
  form.hidden = false;
  $('#stepper').hidden = false;
  $('#successBox').hidden = true;
  showStep(0);
});

// ---------- Tracking ----------
// Status advances with time since submission (demo: 1 stage per minute).
const STAGES = [
  ['Application received', 'We have your form and fee details.'],
  ['Documents check', 'Marks and identity details are being verified.'],
  ['Interview scheduled', 'A 15-minute interview slot will be emailed to you.'],
  ['Offer released', 'Your offer letter is ready to download.'],
];

$('#trackForm').addEventListener('submit', e => {
  e.preventDefault();
  const id = $('#trackInput').value.trim().toUpperCase();
  const err = $('#trackError');
  const result = $('#trackResult');
  const app = store.read(STORE_KEY, {})[id];

  if (!id) { err.textContent = 'Enter your application ID.'; result.hidden = true; return; }
  if (!app) { err.textContent = 'No application found with this ID on this device. Check for typing mistakes.'; result.hidden = true; return; }
  err.textContent = '';

  const stage = Math.min(STAGES.length - 1, Math.floor((Date.now() - app.submittedAt) / 60000));
  const prog = PROGRAMS.find(p => p.id === app.program);
  $('#trackSummary').textContent = `${app.fullName} · ${prog ? prog.name : ''} · Submitted ${new Date(app.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  $('#timeline').innerHTML = STAGES.map(([title, note], i) =>
    `<li class="${i < stage ? 'done' : i === stage ? 'current' : ''}"><strong>${title}</strong><span>${note}</span></li>`
  ).join('');
  result.hidden = false;
});

// ---------- Init ----------
showStep(0);
loadDraft();
