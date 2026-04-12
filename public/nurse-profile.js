const API_URL = 'http://localhost:3000/api/nurse';
const token   = localStorage.getItem('nurseToken');
if (!token) window.location.href = 'login.html';

let pageMode    = 'create';
let _savedNurse = null;

// ── SPINNER ───────────────────────────────────────────────
const spinners = {
  availStart: { hour: 9, min: 0, ampm: 'AM' },
  availEnd:   { hour: 5, min: 0, ampm: 'PM' },
};

function changeSpinner(id, part, dir) {
  if (pageMode === 'view') return;
  const s = spinners[id];
  if (part === 'hour')     s.hour = ((s.hour - 1 + dir + 12) % 12) + 1;
  else if (part === 'min') s.min  = (s.min + dir * 5 + 60) % 60;
  else                     s.ampm = s.ampm === 'AM' ? 'PM' : 'AM';
  document.getElementById(`${id}_hour`).textContent = String(s.hour).padStart(2,'0');
  document.getElementById(`${id}_min`).textContent  = String(s.min).padStart(2,'0');
  document.getElementById(`${id}_ampm`).textContent = s.ampm;
}

function setSpinner(id, timeStr) {
  if (!timeStr) return;
  const [time, ap] = timeStr.split(' ');
  const [h, m] = time.split(':').map(Number);
  spinners[id] = { hour: h, min: m, ampm: ap };
  document.getElementById(`${id}_hour`).textContent = String(h).padStart(2,'0');
  document.getElementById(`${id}_min`).textContent  = String(m).padStart(2,'0');
  document.getElementById(`${id}_ampm`).textContent = ap;
}

function getSpinnerTime(id) {
  const s = spinners[id];
  return `${String(s.hour).padStart(2,'0')}:${String(s.min).padStart(2,'0')} ${s.ampm}`;
}

function toMinutes(t) {
  const [time, ap] = t.split(' '); let [h, m] = time.split(':').map(Number);
  if (ap === 'PM' && h !== 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

// ── PHOTO ─────────────────────────────────────────────────
function previewPhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => { document.getElementById('photoPreviewImg').src = e.target.result; };
    reader.readAsDataURL(input.files[0]);
  }
}

// ── VIEW / EDIT MODE ──────────────────────────────────────
function setViewMode() {
  pageMode = 'view';
  document.getElementById('pageTitle').textContent = 'My Profile';
  document.getElementById('editBtn').style.display = 'flex';
  document.getElementById('saveBtn').style.display = 'none';
  document.getElementById('message').textContent   = '';
  document.querySelectorAll('#profileForm input:not([type="hidden"]):not([type="file"]), #profileForm select, #profileForm textarea')
    .forEach(el => { el.disabled = true; });
  document.getElementById('btn-upload-photo-wrap').style.display = 'none';
  document.getElementById('photoInput').disabled = true;
  document.querySelector('.photo-wrap').style.cursor = 'default';
  document.querySelector('.photo-overlay').style.display = 'none';
  document.getElementById('profileForm').classList.add('view-mode');
}

function enterEditMode() {
  pageMode = 'edit';
  document.getElementById('pageTitle').textContent = 'Edit Profile';
  document.getElementById('editBtn').style.display = 'none';
  document.getElementById('saveBtn').style.display = 'flex';
  document.getElementById('saveBtn').innerHTML = '<i class="fas fa-save"></i> Save Changes';
  document.querySelectorAll('#profileForm input:not([type="hidden"]):not([type="file"]), #profileForm select, #profileForm textarea')
    .forEach(el => { el.disabled = false; });
  document.getElementById('btn-upload-photo-wrap').style.display = 'block';
  document.getElementById('photoInput').disabled = false;
  document.querySelector('.photo-wrap').style.cursor = 'pointer';
  document.querySelector('.photo-overlay').style.display = '';
  document.getElementById('profileForm').classList.remove('view-mode');
}

function goBack() {
  if (pageMode === 'edit') { prefillForm(_savedNurse); setViewMode(); }
  else {
    if (window.parent && window.parent !== window && window.parent.closeProfileOverlay) {
      window.parent.closeProfileOverlay();
    } else { window.location.href = 'nurse-dashboard.html'; }
  }
}

// ── PREFILL ───────────────────────────────────────────────
function prefillForm(n) {
  const form = document.getElementById('profileForm');
  form.querySelector('[name="name"]').value            = n.name            || '';
  form.querySelector('[name="age"]').value             = n.age             || '';
  form.querySelector('[name="gender"]').value          = n.gender          || '';
  form.querySelector('[name="qualification"]').value   = n.qualification   || '';
  form.querySelector('[name="permanentAddress"]').value= n.permanentAddress|| '';
  form.querySelector('[name="presentAddress"]').value  = n.presentAddress  || '';
  if (n.profilePhoto) document.getElementById('photoPreviewImg').src = n.profilePhoto;
  if (n.availabilityStart) setSpinner('availStart', n.availabilityStart);
  if (n.availabilityEnd)   setSpinner('availEnd',   n.availabilityEnd);
}

// ── INIT ──────────────────────────────────────────────────
(async () => {
  try {
    const res   = await fetch(`${API_URL}/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const nurse = await res.json();
    if (nurse && nurse.isProfileComplete) {
      _savedNurse = nurse;
      prefillForm(nurse);
      setViewMode();
      document.getElementById('backLabel').textContent = 'Dashboard';
    } else {
      document.getElementById('editBtn').style.display = 'none';
      document.getElementById('saveBtn').style.display = 'flex';
    }
  } catch {}
})();

// ── VALIDATION ────────────────────────────────────────────
function showMsg(text, isError) {
  const el = document.getElementById('message');
  el.textContent = text; el.style.color = isError ? '#e74c3c' : '#27ae60';
}

// ── SUBMIT ────────────────────────────────────────────────
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file     = document.getElementById('photoInput').files[0];
  const existing = document.getElementById('photoPreviewImg').src;
  if (!file && existing.includes('placeholder')) { showMsg('Profile photo is required.', true); return; }
  if (file && !/\.(jpg|jpeg|png)$/i.test(file.name)) { showMsg('Only JPG and PNG accepted.', true); return; }

  const start = getSpinnerTime('availStart');
  const end   = getSpinnerTime('availEnd');
  const diff  = (toMinutes(end) - toMinutes(start)) / 60;
  if (diff <= 0) { showMsg('End time must be after start time.', true); return; }
  if (diff > 8)  { showMsg('Availability cannot exceed 8 hours.', true); return; }

  document.getElementById('availabilityStartHidden').value = start;
  document.getElementById('availabilityEndHidden').value   = end;

  const fd = new FormData(e.target);
  if (file) fd.set('profilePhoto', file);

  try {
    const res  = await fetch(`${API_URL}/profile`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd
    });
    const data = await res.json();
    if (res.ok) {
      _savedNurse = data.nurse;
      showMsg(pageMode === 'create' ? 'Profile saved! Redirecting...' : '✓ Profile updated!', false);
      if (pageMode === 'create') {
        setTimeout(() => {
          if (window.parent && window.parent !== window && window.parent.closeProfileOverlay)
            window.parent.closeProfileOverlay();
          else window.location.href = 'nurse-dashboard.html';
        }, 1500);
      } else {
        setTimeout(() => { showMsg('', false); setViewMode(); }, 1200);
      }
    } else { showMsg(data.error || 'Failed to save.', true); }
  } catch { showMsg('Server error.', true); }
});
