const API_URL = 'http://localhost:3000/api/doctor';
const token   = localStorage.getItem('doctorToken');
if (!token) window.location.href = 'login.html';

// ── MODE ──────────────────────────────────────────────────
// 'create' | 'view' | 'edit'
let pageMode = 'create';

// ── SPINNER STATE ─────────────────────────────────────────
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

function toMinutes(timeStr) {
  const [time, ap] = timeStr.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

// ── PER-TYPE SPINNERS ─────────────────────────────────────
function makeTypeSpinner(typeId) {
  spinners[`${typeId}_start`] = { hour: 9, min: 0, ampm: 'AM' };
  spinners[`${typeId}_end`]   = { hour: 5, min: 0, ampm: 'PM' };
  const label = typeId === 'home_visit' ? 'Home Visit'
              : typeId.charAt(0).toUpperCase() + typeId.slice(1);
  const icon  = typeId === 'online' ? 'fa-video'
              : typeId === 'home_visit' ? 'fa-house-medical' : 'fa-hospital';
  return `
    <div class="apt-avail-block" id="aptAvail_${typeId}">
      <div class="apt-avail-label"><i class="fas ${icon}"></i> ${label}</div>
      <div class="avail-row">
        <div class="form-group"><label>Start</label>${makeSpinnerHTML(`${typeId}_start`)}</div>
        <div class="avail-dash">—</div>
        <div class="form-group"><label>End</label>${makeSpinnerHTML(`${typeId}_end`)}</div>
      </div>
    </div>`;
}

function makeSpinnerHTML(id) {
  return `
    <div class="time-spinner">
      <div class="ts-col">
        <button type="button" class="ts-arrow" onclick="changeSpinner('${id}','hour',1)"><i class="fas fa-chevron-up"></i></button>
        <div class="ts-val" id="${id}_hour">09</div>
        <button type="button" class="ts-arrow" onclick="changeSpinner('${id}','hour',-1)"><i class="fas fa-chevron-down"></i></button>
      </div>
      <div class="ts-sep">:</div>
      <div class="ts-col">
        <button type="button" class="ts-arrow" onclick="changeSpinner('${id}','min',1)"><i class="fas fa-chevron-up"></i></button>
        <div class="ts-val" id="${id}_min">00</div>
        <button type="button" class="ts-arrow" onclick="changeSpinner('${id}','min',-1)"><i class="fas fa-chevron-down"></i></button>
      </div>
      <div class="ts-sep ts-sep-ampm"></div>
      <div class="ts-col">
        <button type="button" class="ts-arrow" onclick="changeSpinner('${id}','ampm',1)"><i class="fas fa-chevron-up"></i></button>
        <div class="ts-val ts-ampm" id="${id}_ampm">AM</div>
        <button type="button" class="ts-arrow" onclick="changeSpinner('${id}','ampm',-1)"><i class="fas fa-chevron-down"></i></button>
      </div>
    </div>`;
}

// ── SPECIALIZATIONS ───────────────────────────────────────
let specs = [];

function addSpec() {
  if (pageMode === 'view') return;
  const input = document.getElementById('specInput');
  const val   = input.value.trim();
  if (!val) return;
  if (specs.length >= 5) { alert('Maximum 5 specializations allowed.'); return; }
  if (!specs.includes(val)) { specs.push(val); renderSpecChips(); }
  input.value = '';
}

document.getElementById('specInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addSpec(); }
});

function removeSpec(i) {
  if (pageMode === 'view') return;
  specs.splice(i, 1);
  renderSpecChips();
}

function renderSpecChips() {
  const isView = pageMode === 'view';
  document.getElementById('specChips').innerHTML = specs.length
    ? specs.map((s, i) => `
        <div class="spec-chip">
          <span>${s}</span>
          ${!isView ? `<i class="fas fa-times" onclick="removeSpec(${i})"></i>` : ''}
        </div>`).join('')
    : (isView ? '<span style="color:#aaa;font-size:13px;">None added</span>' : '');
}

// ── APPOINTMENT TYPES ─────────────────────────────────────
let selectedTypes = [];

function toggleAptType(type, checked) {
  if (pageMode === 'view') return;
  if (checked) { if (!selectedTypes.includes(type)) selectedTypes.push(type); }
  else { selectedTypes = selectedTypes.filter(t => t !== type); }
  renderAptTypeAvailFields();
  document.getElementById('clinicFields').style.display =
    selectedTypes.includes('clinic') ? 'block' : 'none';
  document.getElementById('aptTypeAvailSection').style.display =
    selectedTypes.length ? 'block' : 'none';
}

function renderAptTypeAvailFields() {
  document.getElementById('aptTypeAvailFields').innerHTML =
    selectedTypes.map(t => makeTypeSpinner(t)).join('');
}

// ── PHOTO PREVIEWS ────────────────────────────────────────
function previewPhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => { document.getElementById('photoPreviewImg').src = e.target.result; };
    reader.readAsDataURL(input.files[0]);
  }
}

function previewClinicPhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.getElementById('clinicPhotoPreview');
      img.src = e.target.result;
      img.style.display = 'block';
      document.getElementById('clinicUploadPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// ── VIEW / EDIT MODE TOGGLE ───────────────────────────────
function setViewMode() {
  pageMode = 'view';
  document.getElementById('pageTitle').textContent = 'My Profile';
  document.getElementById('editBtn').style.display = 'flex';
  document.getElementById('saveBtn').style.display = 'none';
  document.getElementById('message').textContent   = '';

  // Disable all form inputs
  document.querySelectorAll('#profileForm input:not([type="hidden"]):not([type="file"]), #profileForm select, #profileForm textarea')
    .forEach(el => { el.disabled = true; });

  // Hide upload controls
  document.getElementById('btn-upload-photo-wrap').style.display = 'none';
  document.getElementById('photoInput').disabled = true;
  document.querySelector('.photo-wrap').style.cursor = 'default';
  document.querySelector('.photo-overlay').style.display = 'none';
  document.getElementById('clinicPhotoInput').disabled = true;
  document.querySelector('.clinic-photo-wrap').style.cursor = 'default';
  document.querySelector('.clinic-photo-wrap').onclick = null;

  // Hide spec add row
  document.getElementById('specInputRow').style.display = 'none';

  // Re-render chips without remove buttons
  renderSpecChips();

  // Style form as view
  document.getElementById('profileForm').classList.add('view-mode');
}

function enterEditMode() {
  pageMode = 'edit';
  document.getElementById('pageTitle').textContent = 'Edit Profile';
  document.getElementById('editBtn').style.display = 'none';
  document.getElementById('saveBtn').style.display = 'flex';
  document.getElementById('saveBtn').innerHTML = '<i class="fas fa-save"></i> Save Changes';

  // Enable all form inputs
  document.querySelectorAll('#profileForm input:not([type="hidden"]):not([type="file"]), #profileForm select, #profileForm textarea')
    .forEach(el => { el.disabled = false; });

  // Show upload controls
  document.getElementById('btn-upload-photo-wrap').style.display = 'block';
  document.getElementById('photoInput').disabled = false;
  document.querySelector('.photo-wrap').style.cursor = 'pointer';
  document.querySelector('.photo-overlay').style.display = '';
  document.getElementById('clinicPhotoInput').disabled = false;
  document.querySelector('.clinic-photo-wrap').style.cursor = 'pointer';
  document.querySelector('.clinic-photo-wrap').onclick =
    () => document.getElementById('clinicPhotoInput').click();

  // Show spec add row
  document.getElementById('specInputRow').style.display = 'flex';

  // Re-render chips with remove buttons
  renderSpecChips();

  document.getElementById('profileForm').classList.remove('view-mode');
}

function goBack() {
  if (pageMode === 'edit') {
    // Cancel edit → back to view
    prefillForm(_savedDoctor);
    setViewMode();
  } else {
    // Close overlay if inside iframe, otherwise navigate
    if (window.parent && window.parent !== window && window.parent.closeProfileOverlay) {
      window.parent.closeProfileOverlay();
    } else {
      window.location.href = 'doctor-dashboard.html';
    }
  }
}

// ── PRE-FILL ──────────────────────────────────────────────
let _savedDoctor = null;

function prefillForm(d) {
  const form = document.getElementById('profileForm');
  form.querySelector('[name="firstName"]').value        = d.firstName        || '';
  form.querySelector('[name="lastName"]').value         = d.lastName         || '';
  form.querySelector('[name="age"]').value              = d.age              || '';
  form.querySelector('[name="gender"]').value           = d.gender           || '';
  form.querySelector('[name="medicalDegree"]').value    = d.medicalDegree    || '';
  form.querySelector('[name="yearOfCompletion"]').value = d.yearOfCompletion || '';
  form.querySelector('[name="permanentAddress"]').value = d.permanentAddress || '';
  form.querySelector('[name="presentAddress"]').value   = d.presentAddress   || '';

  if (d.profilePhoto) document.getElementById('photoPreviewImg').src = d.profilePhoto;

  specs = Array.isArray(d.specializations) ? [...d.specializations] : [];
  renderSpecChips();

  if (d.availabilityStart) setSpinner('availStart', d.availabilityStart);
  if (d.availabilityEnd)   setSpinner('availEnd',   d.availabilityEnd);

  selectedTypes = Array.isArray(d.appointmentTypes) ? [...d.appointmentTypes] : [];
  ['online','home_visit','clinic'].forEach(t => {
    const cb = document.querySelector(`#toggle_${t} input`);
    if (cb) cb.checked = selectedTypes.includes(t);
  });
  renderAptTypeAvailFields();
  document.getElementById('clinicFields').style.display =
    selectedTypes.includes('clinic') ? 'block' : 'none';
  document.getElementById('aptTypeAvailSection').style.display =
    selectedTypes.length ? 'block' : 'none';

  if (d.aptTypeAvailability) {
    selectedTypes.forEach(t => {
      const av = d.aptTypeAvailability[t];
      if (av) {
        if (av.start) setSpinner(`${t}_start`, av.start);
        if (av.end)   setSpinner(`${t}_end`,   av.end);
      }
    });
  }

  if (d.clinicName)    document.getElementById('clinicName').value = d.clinicName;
  if (d.clinicAddress) document.getElementById('clinicAddress').value = d.clinicAddress;
  if (d.clinicPhoto) {
    const img = document.getElementById('clinicPhotoPreview');
    img.src = d.clinicPhoto;
    img.style.display = 'block';
    document.getElementById('clinicUploadPlaceholder').style.display = 'none';
  }
}

// ── INIT ──────────────────────────────────────────────────
(async () => {
  try {
    const res = await fetch(`${API_URL}/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const doctor = await res.json();

    if (doctor && doctor.isProfileComplete) {
      _savedDoctor = doctor;
      prefillForm(doctor);
      setViewMode();
      document.getElementById('backLabel').textContent = 'Dashboard';
    } else {
      // Create mode — show form editable, no Edit button
      pageMode = 'create';
      document.getElementById('pageTitle').textContent = 'Complete Your Profile';
      document.getElementById('editBtn').style.display = 'none';
      document.getElementById('saveBtn').style.display = 'flex';
      document.getElementById('saveBtn').innerHTML = '<i class="fas fa-save"></i> Save Profile';
      document.getElementById('backLabel').textContent = 'Back';
    }
  } catch {
    pageMode = 'create';
  }
})();

// ── VALIDATION ────────────────────────────────────────────
function validatePhoto() {
  const file     = document.getElementById('photoInput').files[0];
  const existing = document.getElementById('photoPreviewImg').src;
  if (!file && existing.includes('placeholder')) {
    showMsg('Profile photo is required.', true); return false;
  }
  if (file && !/\.(jpg|jpeg|png)$/i.test(file.name)) {
    showMsg('Only JPG and PNG images are accepted.', true); return false;
  }
  return true;
}

function showMsg(text, isError) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.style.color = isError ? '#e74c3c' : '#27ae60';
}

// ── FORM SUBMIT ───────────────────────────────────────────
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validatePhoto()) return;
  showMsg('', false);

  const startTime = getSpinnerTime('availStart');
  const endTime   = getSpinnerTime('availEnd');
  const diffHours = (toMinutes(endTime) - toMinutes(startTime)) / 60;
  if (diffHours <= 0) { showMsg('End time must be after start time.', true); return; }
  if (diffHours > 8)  { showMsg('Availability cannot exceed 8 hours per day.', true); return; }

  const aptTypeAvail = {};
  for (const t of selectedTypes) {
    const s  = getSpinnerTime(`${t}_start`);
    const en = getSpinnerTime(`${t}_end`);
    const td = (toMinutes(en) - toMinutes(s)) / 60;
    if (td <= 0)        { showMsg(`End time must be after start for ${t}.`, true); return; }
    if (td > diffHours) { showMsg(`${t} availability must be within main availability.`, true); return; }
    aptTypeAvail[t] = { start: s, end: en };
  }

  document.getElementById('availabilityStartHidden').value    = startTime;
  document.getElementById('availabilityEndHidden').value      = endTime;
  document.getElementById('specializationsHiddenFinal').value = JSON.stringify(specs);
  document.getElementById('appointmentTypesHidden').value     = JSON.stringify(selectedTypes);
  document.getElementById('aptTypeAvailabilityHidden').value  = JSON.stringify(aptTypeAvail);

  const fd = new FormData(e.target);
  const profileFile = document.getElementById('photoInput').files[0];
  const clinicFile  = document.getElementById('clinicPhotoInput').files[0];
  if (profileFile) fd.set('profilePhoto', profileFile);
  if (clinicFile)  fd.set('clinicPhoto',  clinicFile);

  try {
    const res  = await fetch(`${API_URL}/profile`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: fd
    });
    const data = await res.json();
    if (res.ok) {
      _savedDoctor = data.doctor;
      showMsg(pageMode === 'create' ? 'Profile saved! Redirecting...' : '✓ Profile updated!', false);
      if (pageMode === 'create') {
        setTimeout(() => {
          if (window.parent && window.parent !== window && window.parent.closeProfileOverlay) {
            window.parent.closeProfileOverlay();
          } else {
            window.location.href = 'doctor-dashboard.html';
          }
        }, 1500);
      } else {
        setTimeout(() => { showMsg('', false); setViewMode(); }, 1200);
      }
    } else {
      showMsg(data.error || 'Failed to save profile.', true);
    }
  } catch {
    showMsg('Server error. Please try again.', true);
  }
});
