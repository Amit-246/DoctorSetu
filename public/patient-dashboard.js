const API     = 'http://localhost:3000/api/patient';
const token   = localStorage.getItem('patientToken');
const profile = JSON.parse(localStorage.getItem('patientProfile') || 'null');
const mobile  = localStorage.getItem('patientMobile') || '';

if (!token || !profile) {
  window.location.href = 'patient-select.html';
}

let allPatients     = [];
let allAppointments = [];
let allMessages     = [];
let allPrescriptions = [];

const relationIcons = {
  Self: 'fa-user', Parent: 'fa-person-cane', Child: 'fa-child',
  Spouse: 'fa-heart', Sibling: 'fa-people-group', Other: 'fa-user-tag'
};

const typeIcons = {
  medical_advice: 'fa-stethoscope', instructions: 'fa-list-check',
  medicine: 'fa-pills', general: 'fa-comment'
};

const typeLabels = {
  medical_advice: 'Medical Advice', instructions: 'Instructions',
  medicine: 'Medicine', general: 'General'
};

// ── INIT ──────────────────────────────────────────────────
function init() {
  document.getElementById('sidebarName').textContent     = profile.name || 'Patient';
  document.getElementById('sidebarRelation').textContent = profile.relation || 'Self';
  document.getElementById('pdName').textContent          = profile.name || 'Patient';
  document.getElementById('pdMobile').textContent        = mobile;
  document.getElementById('epModalMobile').textContent   = mobile;
  loadAll();

  document.addEventListener('click', e => {
    if (!document.getElementById('notifPanel').contains(e.target) &&
        !document.getElementById('notifBtn').contains(e.target)) {
      document.getElementById('notifPanel').classList.remove('open');
    }
    if (!document.getElementById('profileDropdown').contains(e.target) &&
        !document.getElementById('topAvatar').contains(e.target)) {
      document.getElementById('profileDropdown').classList.remove('open');
    }
  });
}

async function loadAll() {
  await Promise.all([loadPatients(), loadAppointments(), loadMessages(), loadPrescriptions()]);
  renderFullAppointments();
  buildNotifications();
}

// ── PATIENTS ──────────────────────────────────────────────
async function loadPatients() {
  try {
    const res = await fetch(`${API}/auth/profiles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    allPatients = await res.json();
  } catch { allPatients = []; }
}

function renderFullPatients() {
  const el = document.getElementById('fullPatientList');
  if (!allPatients.length) {
    el.innerHTML = '<p class="empty-state"><i class="fas fa-users"></i><br>No family members added yet.</p>';
    return;
  }
  el.innerHTML = allPatients.map(p => patientGridCardHTML(p)).join('');
}

function patientGridCardHTML(p) {
  const rel  = (p.relation || 'other').toLowerCase();
  const icon = relationIcons[p.relation] || 'fa-user';
  return `
    <div class="pg-card" onclick="openAddModalForPatient('${p._id}')" style="cursor:pointer;">
      <div class="pg-avatar ${rel}"><i class="fas ${icon}"></i></div>
      <h3>${p.name || p.firstName}</h3>
      <span class="rel-tag">${p.relation || 'Self'}</span>
      <p class="pg-meta">${p.gender} &bull; ${p.age} yrs${p.bloodGroup ? '<br>' + p.bloodGroup : ''}</p>
      <button class="btn-book-apt"><i class="fas fa-calendar-plus"></i> Book Appointment</button>
    </div>`;
}

// ── APPOINTMENTS ──────────────────────────────────────────
async function loadAppointments() {
  try {
    const activeId = JSON.parse(localStorage.getItem('patientProfile') || '{}')._id;
    const url = activeId ? `${API}/appointments?patientId=${activeId}` : `${API}/appointments`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('patientToken')}` }
    });
    allAppointments = await res.json();
  } catch { allAppointments = []; }
}

function renderFullAppointments(filter = 'all') {
  const el   = document.getElementById('fullAptList');
  const list = filter === 'all'
    ? allAppointments
    : allAppointments.filter(a => a.status === filter);

  el.innerHTML = list.length
    ? list.map(a => aptCardHTML(a)).join('')
    : `<p class="empty-state"><i class="fas fa-calendar-times"></i><br>No ${filter === 'all' ? '' : filter} appointments.</p>`;
}

function aptCardHTML(a) {
  const icons = { pending: 'fa-clock', confirmed: 'fa-check-circle', cancelled: 'fa-times-circle' };
  const patientName = a.patientId ? (a.patientId.name || a.patientId.firstName || 'Patient') : 'Patient';
  const doctorName  = a.doctorId  ? `Dr. ${a.doctorId.firstName || ''} ${a.doctorId.lastName || ''}`.trim() : 'Doctor';
  const canCancel   = a.status === 'pending';
  const isConfirmed = a.status === 'confirmed';
  const isOnline    = a.appointmentType === 'online';
  const canJoin     = isConfirmed && isOnline && isWithinJoinWindow(a.appointmentDate, a.timeSlot);

  return `
    <div class="apt-card ${a.status}${isConfirmed ? ' apt-card-clickable' : ''}" ${isConfirmed ? `onclick="viewDoctorDetails('${a._id}')"` : ''}>
      <div class="apt-icon"><i class="fas ${icons[a.status] || 'fa-calendar'}"></i></div>
      <div class="apt-info">
        <h4>${patientName}</h4>
        <p>${doctorName} &bull; ${a.healthProblem || 'General Checkup'}</p>
        ${isOnline ? '<span class="apt-type-tag online"><i class="fas fa-video"></i> Online</span>' : ''}
        ${isConfirmed ? '<span class="apt-view-doctor"><i class="fas fa-eye"></i> View Doctor Details</span>' : ''}
      </div>
      <div class="apt-meta">
        <span class="status-badge ${a.status}">${a.status}</span>
        <p>${a.appointmentDate && !isNaN(new Date(a.appointmentDate)) ? new Date(a.appointmentDate).toLocaleDateString() : 'Select Date & Time'} &bull; ${a.timeSlot || '—'}</p>
        ${canJoin ? `<button class="btn-join-call" onclick="joinConsultation('${a._id}', event)">
          <i class="fas fa-video"></i> Join
        </button>` : ''}
        ${canCancel ? `<button class="btn-cancel-apt" onclick="cancelPatientAppointment('${a._id}', event)">
          <i class="fas fa-times"></i> Cancel
        </button>` : ''}
      </div>
    </div>`;
}

// ── ONLINE CONSULTATION ────────────────────────────────────────────────
function isWithinJoinWindow(aptDate, timeSlot) {
  if (!aptDate || !timeSlot) return false;
  try {
    // Parse time from slot like "09:00 AM" or "09:00 AM – 09:30 AM"
    const slotStart = timeSlot.split('–')[0].trim();
    const [time, ap] = slotStart.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    const date = new Date(aptDate);
    date.setHours(h, m, 0, 0);
    const now  = new Date();
    const diff = (date - now) / 60000; // minutes
    return diff <= 10 && diff >= -60;  // 10 min before to 60 min after
  } catch { return false; }
}

function joinConsultation(aptId, e) {
  e.stopPropagation();
  const apt  = allAppointments.find(a => a._id === aptId);
  const p    = JSON.parse(localStorage.getItem('patientProfile') || '{}');
  const name = encodeURIComponent(p.name || p.firstName || 'Patient');
  window.open(`consultation.html?appointmentId=${aptId}&role=patient&name=${name}`, '_blank');
}

function viewDoctorDetails(aptId) {
  const apt = allAppointments.find(a => a._id === aptId);
  if (!apt || !apt.doctorId) return;
  const d = apt.doctorId;
  const name = `Dr. ${d.firstName || ''} ${d.lastName || ''}`.trim();

  document.getElementById('docModalName').textContent   = name;
  document.getElementById('docModalDegree').textContent = d.medicalDegree || 'General Physician';

  const avatarEl = document.getElementById('docModalAvatar');
  avatarEl.innerHTML = d.profilePhoto
    ? `<img src="${d.profilePhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : '<i class="fas fa-user-md"></i>';

  document.getElementById('docModalBody').innerHTML = `
    <div class="doc-info-grid">
      <div class="doc-info-item">
        <i class="fas fa-graduation-cap"></i>
        <div><span>Qualification</span><strong>${d.medicalDegree || 'N/A'}</strong></div>
      </div>
      <div class="doc-info-item">
        <i class="fas fa-calendar-check"></i>
        <div><span>Year of Completion</span><strong>${d.yearOfCompletion || 'N/A'}</strong></div>
      </div>
      <div class="doc-info-item">
        <i class="fas fa-phone"></i>
        <div><span>Contact</span><strong>${d.mobile || 'N/A'}</strong></div>
      </div>
      <div class="doc-info-item">
        <i class="fas fa-hospital"></i>
        <div><span>Clinic / Address</span><strong>${d.presentAddress || 'N/A'}</strong></div>
      </div>
    </div>
    <div class="doc-apt-summary">
      <i class="fas fa-calendar-alt"></i>
      Appointment: <strong>${apt.appointmentDate && !isNaN(new Date(apt.appointmentDate)) ? new Date(apt.appointmentDate).toLocaleDateString() : '—'}</strong>
      &nbsp;&bull;&nbsp; <strong>${apt.timeSlot || '—'}</strong>
      &nbsp;&bull;&nbsp; <span class="status-badge confirmed">Confirmed</span>
    </div>`;

  document.getElementById('doctorModal').classList.add('open');
}

function closeDoctorModal() {
  document.getElementById('doctorModal').classList.remove('open');
}

document.getElementById('doctorModal').addEventListener('click', e => {
  if (e.target === document.getElementById('doctorModal')) closeDoctorModal();
});

async function cancelPatientAppointment(id, e) {
  e.stopPropagation();
  if (!confirm('Cancel this appointment?')) return;
  try {
    const res  = await fetch(`${API}/appointments/${id}/cancel`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) { await loadAppointments(); renderFullAppointments(); }
    else alert(data.error || 'Could not cancel.');
  } catch { alert('Server error.'); }
}

function filterApts(filter, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderFullAppointments(filter);
}

// ── PRESCRIPTIONS ────────────────────────────────────────────────
async function loadPrescriptions() {
  try {
    const activeId = JSON.parse(localStorage.getItem('patientProfile') || '{}')._id;
    const url = activeId ? `${API}/prescriptions?patientId=${activeId}` : `${API}/prescriptions`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('patientToken')}` }
    });
    allPrescriptions = await res.json();
  } catch { allPrescriptions = []; }
}

let rxFilter = 'all';

function filterRx(filter, btn) {
  document.querySelectorAll('.rx-filter-tabs .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  rxFilter = filter;
  renderPrescriptions();
}

function renderPrescriptions() {
  const el   = document.getElementById('rxList');
  const list = rxFilter === 'all'
    ? allPrescriptions
    : allPrescriptions.filter(r => r.type === rxFilter);

  if (!list.length) {
    el.innerHTML = `<p class="empty-state"><i class="fas fa-file-medical"></i><br>No ${rxFilter === 'all' ? '' : rxFilter + 's'} found.</p>`;
    return;
  }

  el.innerHTML = list.map(r => {
    const docName   = r.doctorId ? `Dr. ${r.doctorId.firstName || ''} ${r.doctorId.lastName || ''}`.trim() : null;
    const patName   = r.patientId?.name || r.patientId?.firstName || 'Patient';
    const date      = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
    const isImg     = r.filePath && /\.(jpg|jpeg|png|gif)$/i.test(r.filePath);
    const typeIcon  = r.type === 'prescription' ? 'fa-prescription' : 'fa-file-medical-alt';
    const typeLabel = r.type === 'prescription' ? 'Prescription' : 'Report';
    const typeClass = r.type === 'prescription' ? 'rx-type-prescription' : 'rx-type-report';

    const fileActions = r.filePath ? `
      <a class="rx-btn rx-btn-view" href="${r.filePath}" target="_blank"><i class="fas fa-eye"></i> View</a>
      <a class="rx-btn rx-btn-download" href="${r.filePath}" download><i class="fas fa-download"></i> Download</a>` : '';

    return `
      <div class="rx-card">
        <div class="rx-icon-wrap ${typeClass}"><i class="fas ${typeIcon}"></i></div>
        <div class="rx-info">
          <div class="rx-top">
            <span class="rx-label">${r.label || typeLabel}</span>
            <span class="rx-type-badge ${typeClass}">${typeLabel}</span>
          </div>
          <p class="rx-meta">
            <i class="fas fa-user"></i> ${patName}
            ${docName ? `&nbsp;&bull;&nbsp;<i class="fas fa-user-md"></i> ${docName}` : ''}
            &nbsp;&bull;&nbsp;<i class="fas fa-calendar"></i> ${date}
          </p>
          ${r.textContent ? `<p class="rx-text-content">${r.textContent}</p>` : ''}
          ${r.filePath ? `<div class="rx-thumb-wrap">${isImg
            ? `<img src="${r.filePath}" class="rx-thumb">`
            : `<div class="rx-file-icon"><i class="fas fa-file-pdf"></i> PDF</div>`}</div>` : ''}
        </div>
        <div class="rx-actions">${fileActions}</div>
      </div>`;
  }).join('');
}

// ── STEP 3 EXISTING PRESCRIPTION PICKER ───────────────────────────
let selectedExistingRx = [];
let activeUploadTab    = 'upload';

function switchUploadTab(tab) {
  activeUploadTab = tab;
  document.getElementById('tabUpload').classList.toggle('active',   tab === 'upload');
  document.getElementById('tabExisting').classList.toggle('active', tab === 'existing');
  document.getElementById('uploadNewPanel').style.display   = tab === 'upload'   ? 'block' : 'none';
  document.getElementById('useExistingPanel').style.display = tab === 'existing' ? 'block' : 'none';
  if (tab === 'existing') renderExistingRxPicker();
}

function renderExistingRxPicker() {
  const el        = document.getElementById('existingRxPickList');
  const withFiles = allPrescriptions.filter(r => r.filePath);
  if (!withFiles.length) {
    el.innerHTML = '<p class="rx-empty-pick"><i class="fas fa-folder-open"></i> No existing files found. Upload a new one.</p>';
    renderSelectedRxPreview();
    return;
  }
  el.innerHTML = withFiles.map(r => {
    const date       = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '';
    const isImg      = /\.(jpg|jpeg|png|gif)$/i.test(r.filePath);
    const isSelected = selectedExistingRx.some(x => x.filePath === r.filePath);
    const safeLabel  = (r.label || 'File').replace(/"/g, '&quot;');
    return `
      <div class="rx-pick-item ${isSelected ? 'selected' : ''}" onclick="toggleRxPick('${r.filePath}','${safeLabel}')">
        <div class="rx-pick-icon">${isImg ? `<img src="${r.filePath}">` : '<i class="fas fa-file-pdf"></i>'}</div>
        <div class="rx-pick-info"><span>${r.label || 'Medical File'}</span><small>${date}</small></div>
        <div class="rx-pick-check"><i class="fas fa-check-circle"></i></div>
      </div>`;
  }).join('');
  renderSelectedRxPreview();
}

function toggleRxPick(filePath, label) {
  const idx = selectedExistingRx.findIndex(x => x.filePath === filePath);
  if (idx >= 0) selectedExistingRx.splice(idx, 1);
  else selectedExistingRx.push({ filePath, label });
  renderExistingRxPicker();
}

function renderSelectedRxPreview() {
  const el = document.getElementById('selectedRxPreview');
  el.innerHTML = selectedExistingRx.map((r, i) => {
    const isImg = /\.(jpg|jpeg|png|gif)$/i.test(r.filePath);
    return `<div class="file-chip">
      <i class="fas ${isImg ? 'fa-image' : 'fa-file-pdf'}" style="color:${isImg ? '#3498db' : '#e74c3c'}"></i>
      <span>${r.label.length > 22 ? r.label.substring(0,20)+'...' : r.label}</span>
      <i class="fas fa-times remove-file" onclick="removeSelectedRx(${i})"></i>
    </div>`;
  }).join('');
}

function removeSelectedRx(i) {
  selectedExistingRx.splice(i, 1);
  renderExistingRxPicker();
}

function initStep3RxPicker() {
  const withFiles = allPrescriptions.filter(r => r.filePath);
  const badge     = document.getElementById('rxCountBadge');
  badge.textContent    = withFiles.length;
  badge.style.display  = withFiles.length ? 'inline-flex' : 'none';
  switchUploadTab('upload');
  selectedExistingRx = [];
}

async function loadMessages() {
  try {
    const activeId = JSON.parse(localStorage.getItem('patientProfile') || '{}')._id;
    const url = activeId ? `${API}/messages?patientId=${activeId}` : `${API}/messages`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('patientToken')}` }
    });
    allMessages = await res.json();
  } catch { allMessages = []; }
}

function renderMessages() {
  const el = document.getElementById('messagesList');

  if (!allMessages.length) {
    el.innerHTML = '<p class="empty-state"><i class="fas fa-inbox"></i><br>No messages from doctor yet.</p>';
    return;
  }
  el.innerHTML = allMessages.map(m => {
    const docName = m.doctorId
      ? `Dr. ${m.doctorId.firstName || ''} ${m.doctorId.lastName || ''}`.trim()
      : 'Your Doctor';
    return `
    <div class="msg-card ${m.type}">
      <div class="msg-top">
        <span class="msg-type-tag"><i class="fas ${typeIcons[m.type]}"></i> ${typeLabels[m.type]}</span>
        <span class="msg-time">${new Date(m.createdAt).toLocaleString()}</span>
      </div>
      <p class="msg-text">${m.message}</p>
      <p class="msg-from"><i class="fas fa-user-md"></i> ${docName}</p>
    </div>`;
  }).join('');
}

// ── NOTIFICATIONS ─────────────────────────────────────────
let readNotifIds = JSON.parse(localStorage.getItem('patientReadNotifs') || '[]');

function buildNotifications() {
  const notifs = [];
  allAppointments.forEach(a => {
    const docName = a.doctorId
      ? `Dr. ${a.doctorId.firstName || ''} ${a.doctorId.lastName || ''}`.trim()
      : 'Doctor';
    const date = a.updatedAt || a.createdAt || '';
    if (a.status === 'confirmed')
      notifs.push({ id: `apt-confirmed-${a._id}`, icon: 'fa-check-circle', color: '#11998e', section: 'appointments',
        text: `Appointment with <strong>${docName}</strong> confirmed.`, date });
    else if (a.status === 'cancelled')
      notifs.push({ id: `apt-cancelled-${a._id}`, icon: 'fa-times-circle', color: '#e74c3c', section: 'appointments',
        text: `Appointment with <strong>${docName}</strong> was cancelled.`, date });
    else if (a.status === 'pending')
      notifs.push({ id: `apt-pending-${a._id}`, icon: 'fa-clock', color: '#f7971e', section: 'appointments',
        text: `Appointment with <strong>${docName}</strong> is pending confirmation.`, date });
  });
  allMessages.forEach(m => {
    const docName = m.doctorId
      ? `Dr. ${m.doctorId.firstName || ''} ${m.doctorId.lastName || ''}`.trim()
      : 'Doctor';
    const date = m.createdAt || '';
    notifs.push({ id: `msg-${m._id}`, icon: 'fa-comment-medical', color: '#667eea', section: 'messages',
      text: `Message from <strong>${docName}</strong>: ${m.message.substring(0,50)}${m.message.length>50?'...':''}`, date });
  });
  notifs.sort((a, b) => new Date(b.date) - new Date(a.date));
  const unread = notifs.filter(n => !readNotifIds.includes(n.id)).length;
  const badge  = document.getElementById('notifBadge');
  badge.textContent    = unread;
  badge.style.display  = unread > 0 ? 'flex' : 'none';
  const listEl = document.getElementById('notifList');
  if (!notifs.length) {
    listEl.innerHTML = '<p class="notif-empty"><i class="fas fa-bell-slash"></i><br>No notifications yet</p>';
    return;
  }
  listEl.innerHTML = notifs.map(n => `
    <div class="notif-item ${readNotifIds.includes(n.id) ? 'read' : 'unread'}" onclick="navigateFromNotif('${n.section}','${n.id}')">
      <div class="notif-icon" style="background:${n.color}20;color:${n.color}">
        <i class="fas ${n.icon}"></i>
      </div>
      <div class="notif-content">
        <p>${n.text}</p>
        <span>${n.date ? new Date(n.date).toLocaleString() : ''}</span>
      </div>
      <i class="fas fa-chevron-right notif-arrow"></i>
    </div>`).join('');
}

function navigateFromNotif(section, notifId) {
  // Mark this notification as read
  if (!readNotifIds.includes(notifId)) {
    readNotifIds.push(notifId);
    localStorage.setItem('patientReadNotifs', JSON.stringify(readNotifIds));
  }
  document.getElementById('notifPanel').classList.remove('open');
  buildNotifications();
  // Navigate to the relevant section
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`${section}Section`).style.display = 'block';
  document.getElementById('sectionTitle').textContent = sectionMeta[section].title;
  document.getElementById('sectionSub').textContent   = sectionMeta[section].sub;
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(`'${section}'`)) {
      item.classList.add('active');
    }
  });
  if (section === 'appointments') renderFullAppointments();
  if (section === 'messages')     renderMessages();
}

function toggleNotifPanel() {
  document.getElementById('notifPanel').classList.toggle('open');
}

function clearNotifications() {
  allAppointments.forEach(a => {
    ['confirmed','cancelled','pending'].forEach(s => {
      const id = `apt-${s}-${a._id}`;
      if (!readNotifIds.includes(id)) readNotifIds.push(id);
    });
  });
  allMessages.forEach(m => {
    const id = `msg-${m._id}`;
    if (!readNotifIds.includes(id)) readNotifIds.push(id);
  });
  localStorage.setItem('patientReadNotifs', JSON.stringify(readNotifIds));
  buildNotifications();
}

const sectionMeta = {
  appointments:  { title: 'Appointments',         sub: 'Track all your booking statuses' },
  messages:      { title: 'Medical Chat',          sub: 'Messages and chat from your doctor' },
  prescriptions: { title: 'Prescription Storage', sub: 'All your medical reports and prescriptions in one place' }
};

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  event.currentTarget.classList.add('active');

  document.getElementById(`${name}Section`).style.display = 'block';
  document.getElementById('sectionTitle').textContent = sectionMeta[name].title;
  document.getElementById('sectionSub').textContent   = sectionMeta[name].sub;

  if (name === 'appointments')  renderFullAppointments();
  if (name === 'messages')      renderMessages();
  if (name === 'prescriptions') renderPrescriptions();
}

// ── SWITCH PROFILE (sidebar) ───────────────────────────────────────
function toggleSwitchProfile() {
  const panel = document.getElementById('switchProfilePanel');
  const icon  = document.getElementById('apSwitchIcon');
  const isOpen = panel.style.display !== 'none';
  if (isOpen) {
    panel.style.display = 'none';
    icon.style.transform = '';
  } else {
    renderSwitchProfileList();
    panel.style.display = 'block';
    icon.style.transform = 'rotate(180deg)';
  }
}

function renderSwitchProfileList() {
  const listEl = document.getElementById('switchProfileList');
  const currentId = JSON.parse(localStorage.getItem('patientProfile') || '{}')._id;
  const patientItems = allPatients.map(p => {
    const rel    = (p.relation || 'other').toLowerCase();
    const icon   = relationIcons[p.relation] || 'fa-user';
    const isActive = p._id === currentId;
    return `
      <div class="sp-item ${isActive ? 'sp-active' : ''}" onclick="switchToProfile('${p._id}')">
        <div class="sp-avatar ${rel}"><i class="fas ${icon}"></i></div>
        <div class="sp-info">
          <span style="font-weight:${isActive ? '700' : '500'}">${p.name || p.firstName}</span>
          <small>${p.relation || 'Self'} &bull; ${p.age} yrs</small>
        </div>
        ${isActive
          ? '<i class="fas fa-check-circle sp-check"></i>'
          : '<i class="fas fa-chevron-right" style="font-size:11px;color:rgba(255,255,255,0.3);"></i>'}
      </div>`;
  }).join('');

  const addBtn = `
    <div class="sp-add-patient" onclick="openAddPatientFromSidebar()">
      <div class="sp-add-icon"><i class="fas fa-plus"></i></div>
      <span>Add Patient</span>
    </div>`;

  listEl.innerHTML = patientItems + addBtn;
}

async function switchToProfile(patientId) {
  const mobileToken = localStorage.getItem('patientToken');
  try {
    const res  = await fetch(`${API}/auth/select-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mobileToken}` },
      body: JSON.stringify({ patientId })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('patientToken',   data.token);
      localStorage.setItem('patientProfile', JSON.stringify(data.patient));
      document.getElementById('sidebarName').textContent     = data.patient.name || 'Patient';
      document.getElementById('sidebarRelation').textContent = data.patient.relation || 'Self';
      document.getElementById('pdName').textContent          = data.patient.name || 'Patient';
      document.getElementById('switchProfilePanel').style.display = 'none';
      document.getElementById('apSwitchIcon').style.transform = '';
      renderSwitchProfileList();
      // Reload all data for the newly selected patient
      await Promise.all([loadAppointments(), loadMessages(), loadPrescriptions()]);
      buildNotifications();
      // Re-render whichever section is currently visible
      if (document.getElementById('appointmentsSection').style.display !== 'none') renderFullAppointments();
      if (document.getElementById('messagesSection').style.display !== 'none')     renderMessages();
      if (document.getElementById('prescriptionsSection').style.display !== 'none') renderPrescriptions();
    }
  } catch { alert('Could not switch profile.'); }
}


function toggleProfileMenu() {
  document.getElementById('profileDropdown').classList.toggle('open');
}

function openEditProfileModal() {
  document.getElementById('profileDropdown').classList.remove('open');
  const p = JSON.parse(localStorage.getItem('patientProfile') || 'null');
  if (!p) return;
  document.getElementById('ep_name').value     = p.name     || '';
  document.getElementById('ep_age').value      = p.age      || '';
  document.getElementById('ep_email').value    = p.email    || '';
  document.getElementById('ep_relation').value = p.relation || 'Self';
  const radio = document.querySelector(`input[name="ep_gender"][value="${p.gender}"]`);
  if (radio) radio.checked = true;
  document.getElementById('epErrMsg').textContent     = '';
  document.getElementById('epSuccessMsg').textContent = '';
  document.getElementById('editProfileModal').classList.add('open');
}

function closeEditProfileModal() {
  document.getElementById('editProfileModal').classList.remove('open');
}

document.getElementById('editProfileModal').addEventListener('click', e => {
  if (e.target === document.getElementById('editProfileModal')) closeEditProfileModal();
});

document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const p      = JSON.parse(localStorage.getItem('patientProfile') || 'null');
  const errEl  = document.getElementById('epErrMsg');
  const sucEl  = document.getElementById('epSuccessMsg');
  const name     = document.getElementById('ep_name').value.trim();
  const age      = document.getElementById('ep_age').value;
  const gender   = document.querySelector('input[name="ep_gender"]:checked')?.value;
  const email    = document.getElementById('ep_email').value.trim();
  const relation = document.getElementById('ep_relation').value;

  if (!name)   { errEl.textContent = 'Please enter your name.';    sucEl.textContent = ''; return; }
  if (!age)    { errEl.textContent = 'Please enter your age.';     sucEl.textContent = ''; return; }
  if (!gender) { errEl.textContent = 'Please select your gender.'; sucEl.textContent = ''; return; }
  errEl.textContent = '';

  try {
    const res  = await fetch(`${API}/auth/profiles/${p._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('patientToken')}` },
      body: JSON.stringify({ name, age, gender, email, relation })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('patientProfile', JSON.stringify(data.patient));
      document.getElementById('sidebarName').textContent     = data.patient.name;
      document.getElementById('sidebarRelation').textContent = data.patient.relation || 'Self';
      document.getElementById('pdName').textContent          = data.patient.name;
      await loadPatients();
      renderSwitchProfileList();
      sucEl.style.color = '#27ae60';
      sucEl.textContent = '✓ Profile updated successfully!';
      setTimeout(() => { sucEl.textContent = ''; closeEditProfileModal(); }, 1500);
    } else {
      errEl.textContent = data.error || 'Update failed.';
    }
  } catch {
    errEl.textContent = 'Server error. Please try again.';
  }
});

// ── ADD PATIENT WIZARD ────────────────────────────────────
let selectedDoctorId  = null;
let selectedAptType   = null;
let selectedHomeVisitType = null;
let selectedSlot      = null;
let selectedDate      = null;
let uploadedFiles     = [];
let currentStep       = 1;
let step4View         = 'doctor'; // 'doctor' | 'clinic'
let allLoadedDoctors  = [];       // cache for clinic view

function openAddModal() {
  const p = JSON.parse(localStorage.getItem('patientProfile') || 'null');
  resetWizard();
  document.getElementById('addModal').classList.add('open');
  if (!p) return;

  // Fill visible editable fields
  document.getElementById('s1_name').value   = p.name || p.firstName || '';
  document.getElementById('s1_age').value    = p.age  || '';
  document.getElementById('s1_gender').value = p.gender || '';
  document.getElementById('s1_relation').value   = p.relation   || 'Self';
  document.getElementById('s1_bloodGroup').value = p.bloodGroup || '';
  if (p.address) document.getElementById('s1_address').value = p.address;

  // Render patient identity card (avatar + name only)
  const rel  = (p.relation || 'other').toLowerCase();
  const icon = relationIcons[p.relation] || 'fa-user';
  document.getElementById('s1PatientAvatar').className = `s1-patient-avatar ${rel}`;
  document.getElementById('s1PatientAvatar').innerHTML = `<i class="fas ${icon}"></i>`;
  document.getElementById('s1PatientName').textContent = p.name || p.firstName || 'Patient';
  const meta = [p.gender, p.age ? `${p.age} yrs` : null, p.bloodGroup, p.relation]
    .filter(Boolean).join(' · ');
  document.getElementById('s1PatientMeta').textContent = meta || '—';
}

function openAddModalForPatient(patientId) {
  // Legacy — just open for active profile
  openAddModal();
}

function openAddPatientFromSidebar() {
  document.getElementById('switchProfilePanel').style.display = 'none';
  document.getElementById('apSwitchIcon').style.transform = '';
  document.getElementById('addMemberForm').reset();
  document.getElementById('addMemberMsg').textContent = '';
  document.getElementById('addMemberModal').classList.add('open');
}

function closeAddMemberModal() {
  document.getElementById('addMemberModal').classList.remove('open');
}

document.getElementById('addMemberModal').addEventListener('click', e => {
  if (e.target === document.getElementById('addMemberModal')) closeAddMemberModal();
});

document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd   = new FormData(e.target);
  const body = Object.fromEntries(fd.entries());
  const msgEl = document.getElementById('addMemberMsg');
  try {
    const res  = await fetch(`${API}/auth/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      msgEl.style.color = '#27ae60';
      msgEl.textContent = '✓ Member added!';
      await loadPatients();
      setTimeout(() => closeAddMemberModal(), 900);
    } else {
      msgEl.style.color = '#e74c3c';
      msgEl.textContent = data.error || 'Failed to add member.';
    }
  } catch {
    msgEl.style.color = '#e74c3c';
    msgEl.textContent = 'Server error.';
  }
});

function closeAddModal() {
  document.getElementById('addModal').classList.remove('open');
  resetWizard();
}

document.getElementById('addModal').addEventListener('click', e => {
  if (e.target === document.getElementById('addModal')) closeAddModal();
});

// ── ENTER KEY IN WIZARD ─────────────────────────────────────
document.getElementById('addModal').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
  e.preventDefault();
  if (currentStep === 1)      goStep(2);
  else if (currentStep === 2) handleStep2Next();
  else if (currentStep === 3) handleStep3Next();
  else if (currentStep === 4) submitBooking();
  else if (currentStep === 'nurse') searchNurses();
});

function resetWizard() {
  currentStep = 1; selectedDoctorId = null; selectedAptType = null;
  selectedHomeVisitType = null; selectedSlot = null; selectedDate = null;
  selectedNurseId = null; selectedNurseSlot = null; uploadedFiles = [];
  selectedExistingRx = []; activeUploadTab = 'upload';
  step4View = 'doctor'; allLoadedDoctors = [];
  resetNurseTimeSpinner();
  const snDate = document.getElementById('sn_date'); if (snDate) snDate.value = '';
  ['step1','step2','step3','step4','stepNurse','stepSuccess'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  document.getElementById('step1').style.display = 'block';
  ['wp1','wp2','wp3','wp4'].forEach(id => {
    const el = document.getElementById(id); if (el) el.classList.remove('active','done');
  });
  document.getElementById('wp1').classList.add('active');
  ['s1_name','s1_age','s1_address','s1_gender','s1_relation','s1_bloodGroup',
   's3_healthProblem','s3_currentTreatment'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('filePreview').innerHTML = '';
  document.getElementById('homeVisitOptions').style.display = 'none';
  document.getElementById('dateTimeFields').style.display   = 'none';
  resetTimeSpinner();
  const s2date = document.getElementById('s2_date'); if (s2date) s2date.value = '';
  document.querySelectorAll('.apt-type-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.hv-card').forEach(c => c.classList.remove('selected'));
  ['step1Err','step2Err','step3Err','step4Err'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '';
  });
}

function goStep(n) {
  if (n > currentStep) {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;
  }
  document.getElementById(`step${currentStep}`).style.display = 'none';
  const wpCurrent = document.getElementById(`wp${currentStep}`);
  if (wpCurrent) { wpCurrent.classList.remove('active'); if (n > currentStep) wpCurrent.classList.add('done'); }
  currentStep = n;
  const nextEl = document.getElementById(`step${currentStep}`);
  nextEl.style.display = currentStep === 4 ? 'flex' : 'block';
  const wpNext = document.getElementById(`wp${currentStep}`);
  if (wpNext) wpNext.classList.add('active');
  if (currentStep === 3) initStep3RxPicker();
  if (currentStep === 4) loadDoctors();
}

function validateStep1() {
  const err = document.getElementById('step1Err');
  if (!document.getElementById('s1_name').value.trim()) {
    err.textContent = 'Please enter the patient name.'; return false;
  }
  if (!document.getElementById('s1_age').value) {
    err.textContent = 'Please enter the patient age.'; return false;
  }
  if (!document.getElementById('s1_gender').value) {
    err.textContent = 'Please select the patient gender.'; return false;
  }
  if (!document.getElementById('s1_address').value.trim()) {
    err.textContent = 'Please enter the present address.'; return false;
  }
  err.textContent = ''; return true;
}

function validateStep2() {
  const err = document.getElementById('step2Err');
  if (!selectedAptType) { err.textContent = 'Please select an appointment type.'; return false; }
  if (selectedAptType === 'home_visit' && !selectedHomeVisitType) {
    err.textContent = 'Please select a home visit type.'; return false;
  }
  if (selectedHomeVisitType !== 'nurse') {
    const dateVal = document.getElementById('s2_date').value;
    if (!dateVal) { err.textContent = 'Please select a preferred date.'; return false; }
    // Validate not in the past
    const selectedDT = parseDateAndTime(dateVal, getSelectedTime());
    if (selectedDT <= new Date()) {
      err.textContent = 'Please select a valid future date and time.'; return false;
    }
  }
  err.textContent = ''; return true;
}

function parseDateAndTime(dateStr, timeStr) {
  // Parse date parts manually to avoid UTC/timezone offset issues with YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);
  const [time, ap]         = timeStr.trim().split(' ');
  let [h, m]               = time.split(':').map(Number);
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  const d = new Date(year, month - 1, day, h, m, 0, 0);
  return d;
}

function validateDateTimeRealtime() {
  const dateVal = document.getElementById('s2_date').value;
  const err     = document.getElementById('step2Err');
  if (!dateVal) return;
  const selectedDT = parseDateAndTime(dateVal, getSelectedTime());
  if (selectedDT <= new Date()) {
    err.textContent = 'Please select a valid future date and time.';
  } else {
    err.textContent = '';
  }
}

function validateStep3() {
  const err = document.getElementById('step3Err');
  if (!document.getElementById('s3_healthProblem').value.trim()) {
    err.textContent = 'Please describe the health problem.'; return false;
  }
  err.textContent = ''; return true;
}

function handleStep2Next() {
  if (!validateStep2()) return;
  if (selectedAptType === 'home_visit' && selectedHomeVisitType === 'nurse') {
    document.getElementById('step2').style.display = 'none';
    document.getElementById('wp2').classList.remove('active');
    document.getElementById('wp2').classList.add('done');
    document.getElementById('sn_date').min = new Date().toISOString().split('T')[0];
    document.getElementById('stepNurse').style.display = 'block';
    currentStep = 'nurse';
    return;
  }
  selectedDate = document.getElementById('s2_date').value;
  selectedSlot = getSelectedTime();
  const isHV    = selectedAptType === 'home_visit' && selectedHomeVisitType === 'doctor';
  const banner  = document.getElementById('hvEmergencyBanner');
  const label   = document.getElementById('s3_problemLabel');
  const treatGrp= document.getElementById('s3_treatmentGroup');
  if (isHV) {
    banner.style.display = 'flex';
    label.textContent = 'Emergency / Health Problem *';
    treatGrp.style.display = 'none';
  } else {
    banner.style.display = 'none';
    label.textContent = 'Health Problem / Reason for Visit *';
    treatGrp.style.display = 'block';
  }
  goStep(3);
}

// ── TIME SPINNER ───────────────────────────────────────────────
let tsHour = 9, tsMin = 0, tsAmPm = 'AM';

function changeTime(part, dir) {
  if (part === 'hour') {
    tsHour = ((tsHour - 1 + dir + 12) % 12) + 1;
    document.getElementById('tsHour').textContent = String(tsHour).padStart(2,'0');
  } else if (part === 'min') {
    tsMin = (tsMin + dir * 5 + 60) % 60;
    document.getElementById('tsMin').textContent = String(tsMin).padStart(2,'0');
  } else {
    tsAmPm = tsAmPm === 'AM' ? 'PM' : 'AM';
    document.getElementById('tsAmPm').textContent = tsAmPm;
  }
}

function getSelectedTime() {
  return `${String(tsHour).padStart(2,'0')}:${String(tsMin).padStart(2,'0')} ${tsAmPm}`;
}

function resetTimeSpinner() {
  tsHour = 9; tsMin = 0; tsAmPm = 'AM';
  document.getElementById('tsHour').textContent = '09';
  document.getElementById('tsMin').textContent  = '00';
  document.getElementById('tsAmPm').textContent = 'AM';
}

function selectAptType(el) {
  document.querySelectorAll('.apt-type-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedAptType = el.dataset.type;
  const hvOpts     = document.getElementById('homeVisitOptions');
  const dateTimeEl = document.getElementById('dateTimeFields');
  if (selectedAptType === 'home_visit') {
    hvOpts.style.display = 'block';
    selectedHomeVisitType = null;
    document.querySelectorAll('.hv-card').forEach(c => c.classList.remove('selected'));
    dateTimeEl.style.display = 'none';
  } else {
    hvOpts.style.display = 'none';
    dateTimeEl.style.display = 'block';
    const d = document.getElementById('s2_date');
    d.min = new Date().toISOString().split('T')[0];
    d.onchange = validateDateTimeRealtime;
  }
}

function selectHomeVisitType(el) {
  document.querySelectorAll('.hv-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedHomeVisitType = el.dataset.hv;
  const dateTimeEl = document.getElementById('dateTimeFields');
  if (selectedHomeVisitType === 'nurse') {
    dateTimeEl.style.display = 'none';
  } else {
    // Doctor Home Visit — auto-fill today + current time + 30 min
    dateTimeEl.style.display = 'block';
    const today = new Date();
    document.getElementById('s2_date').min   = today.toISOString().split('T')[0];
    document.getElementById('s2_date').value = today.toISOString().split('T')[0];

    const future = new Date(today.getTime() + 30 * 60000);
    let h = future.getHours();
    const m   = future.getMinutes();
    const ap  = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    tsHour = h; tsMin = Math.round(m / 5) * 5 % 60; tsAmPm = ap;
    document.getElementById('tsHour').textContent = String(tsHour).padStart(2,'0');
    document.getElementById('tsMin').textContent  = String(tsMin).padStart(2,'0');
    document.getElementById('tsAmPm').textContent = tsAmPm;
  }
}

// ── FILE UPLOAD ───────────────────────────────────────────
function handleFiles(files) {
  Array.from(files).forEach(f => uploadedFiles.push(f));
  renderFilePreviews();
}

function openCamera() { document.getElementById('cameraInput').click(); }

function renderFilePreviews() {
  document.getElementById('filePreview').innerHTML = uploadedFiles.map((f, i) => {
    const isImg = f.type.startsWith('image/');
    return `<div class="file-chip">
      <i class="fas ${isImg ? 'fa-image' : 'fa-file-pdf'}" style="color:${isImg ? '#3498db' : '#e74c3c'}"></i>
      <span>${f.name.length > 20 ? f.name.substring(0,18)+'...' : f.name}</span>
      <i class="fas fa-times remove-file" onclick="removeFile(${i})"></i>
    </div>`;
  }).join('');
}

function removeFile(i) { uploadedFiles.splice(i, 1); renderFilePreviews(); }

const uploadZone = document.getElementById('uploadZone');
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });

// ── LOCATION ──────────────────────────────────────────────
function useCurrentLocation() {
  if (!navigator.geolocation) {
    document.getElementById('step1Err').textContent = 'Geolocation is not supported by your browser.';
    return;
  }

  const btn      = document.getElementById('locationBtn');
  const icon     = document.getElementById('locationIcon');
  const btnText  = document.getElementById('locationBtnText');

  btn.disabled   = true;
  icon.className = 'fas fa-spinner fa-spin';
  btnText.textContent = 'Detecting location...';

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const data = await res.json();
        const addr = data.display_name || `${latitude}, ${longitude}`;
        document.getElementById('s1_address').value = addr;
        document.getElementById('step1Err').textContent = '';
      } catch {
        document.getElementById('s1_address').value = `${latitude}, ${longitude}`;
      }
      btn.disabled   = false;
      icon.className = 'fas fa-location-crosshairs';
      btnText.textContent = 'Use Current Location';
    },
    (err) => {
      const msgs = {
        1: 'Location permission denied. Please allow access and try again.',
        2: 'Location unavailable. Please enter address manually.',
        3: 'Location request timed out. Please try again.'
      };
      document.getElementById('step1Err').textContent = msgs[err.code] || 'Could not get location.';
      btn.disabled   = false;
      icon.className = 'fas fa-location-crosshairs';
      btnText.textContent = 'Use Current Location';
    },
    { timeout: 10000 }
  );
}


function handleStep3Next() {
  if (!validateStep3()) return;
  const isHV = selectedAptType === 'home_visit' && selectedHomeVisitType === 'doctor';
  const dispatchBanner = document.getElementById('hvDispatchBanner');
  const step4Sub       = document.getElementById('step4Sub');
  const confirmBtn     = document.getElementById('step4ConfirmBtn');
  dispatchBanner.style.display = 'flex';
  step4Sub.textContent = isHV
    ? 'Nearest available doctors for emergency home visit'
    : 'Nearest available doctors based on your location';
  confirmBtn.innerHTML = isHV
    ? '<i class="fas fa-ambulance"></i> Confirm Home Visit'
    : '<i class="fas fa-check-circle"></i> Confirm Booking';
  goStep(4);
}

// ── KEYWORD → SPECIALIZATION MAP ─────────────────────────
const SPEC_KEYWORD_MAP = [
  { keywords: ['fever','cold','cough','flu','viral','infection','fatigue','weakness','vomiting','diarrhea','typhoid','malaria'], specs: ['general physician','general medicine','general practice','family medicine'] },
  { keywords: ['heart','chest pain','chest tightness','palpitation','cardiac','blood pressure','hypertension','cholesterol'], specs: ['cardiologist','cardiology','cardiac'] },
  { keywords: ['bone','fracture','joint','knee','spine','back pain','shoulder','hip','arthritis','ligament','orthopedic'], specs: ['orthopedic','orthopaedic','bone','joint'] },
  { keywords: ['skin','rash','acne','eczema','psoriasis','allergy','itching','hair loss','nail','dermatitis'], specs: ['dermatologist','dermatology','skin'] },
  { keywords: ['eye','vision','blur','cataract','glaucoma','retina','spectacles','glasses'], specs: ['ophthalmologist','ophthalmology','eye'] },
  { keywords: ['child','baby','infant','pediatric','vaccination','growth','newborn'], specs: ['pediatrician','pediatrics','child specialist'] },
  { keywords: ['teeth','tooth','gum','cavity','dental','mouth','jaw','braces'], specs: ['dentist','dental','orthodontist'] },
  { keywords: ['brain','headache','migraine','seizure','epilepsy','nerve','paralysis','stroke','memory','dizziness'], specs: ['neurologist','neurology','neuro'] },
  { keywords: ['stomach','abdomen','gastric','acidity','ulcer','liver','digestion','constipation','ibs','colon'], specs: ['gastroenterologist','gastroenterology','gastro','liver specialist'] },
  { keywords: ['kidney','urine','urinary','bladder','stone','dialysis','renal'], specs: ['nephrologist','nephrology','urologist','urology','kidney'] },
  { keywords: ['mental','anxiety','depression','stress','sleep','insomnia','psychiatric','mood','panic'], specs: ['psychiatrist','psychiatry','psychologist','mental health'] },
  { keywords: ['diabetes','thyroid','hormone','obesity','weight','endocrine','insulin'], specs: ['endocrinologist','endocrinology','diabetologist','diabetes'] },
  { keywords: ['lung','breathing','asthma','bronchitis','pneumonia','tb','tuberculosis','respiratory'], specs: ['pulmonologist','pulmonology','chest specialist','respiratory'] },
  { keywords: ['pregnancy','gynec','periods','menstrual','ovary','uterus','fertility','women','breast'], specs: ['gynecologist','gynaecologist','obstetrician','gynecology','women'] },
  { keywords: ['ear','nose','throat','ent','hearing','tonsil','sinus','snoring'], specs: ['ent','otolaryngologist','ear nose throat'] },
  { keywords: ['cancer','tumor','oncology','chemotherapy','biopsy'], specs: ['oncologist','oncology','cancer specialist'] },
];

function getRecommendedSpecs(problem) {
  if (!problem) return [];
  const lower = problem.toLowerCase();
  const matched = new Set();
  for (const entry of SPEC_KEYWORD_MAP) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      entry.specs.forEach(s => matched.add(s));
    }
  }
  return [...matched];
}

function scoreDoctor(d, recommendedSpecs) {
  if (!recommendedSpecs.length) return 0;
  const docSpecs = (d.specializations || []).map(s => s.toLowerCase());
  const degree   = (d.medicalDegree || '').toLowerCase();
  let score = 0;
  for (const rs of recommendedSpecs) {
    if (docSpecs.some(s => s.includes(rs) || rs.includes(s))) score += 2;
    if (degree.includes(rs)) score += 1;
  }
  return score;
}

async function loadDoctors() {
  const statusEl = document.getElementById('doctorsSearchStatus');
  const listEl   = document.getElementById('doctorsList');
  const problem  = document.getElementById('s3_healthProblem').value.trim();
  const isHV     = selectedAptType === 'home_visit' && selectedHomeVisitType === 'doctor';
  statusEl.style.display = 'block';
  listEl.innerHTML = '';
  selectedDoctorId = null;

  // Reset to doctor view and show toggle only for clinic appointment type
  step4View = 'doctor';
  const toggle = document.getElementById('s4ViewToggle');
  toggle.style.display = selectedAptType === 'offline' ? 'flex' : 'none';
  document.getElementById('toggleDoctor').classList.add('active');
  document.getElementById('toggleClinic').classList.remove('active');
  document.getElementById('clinicList').style.display = 'none';
  listEl.style.display = 'block';

  // Map appointment type to API query value
  const typeMap = { online: 'online', offline: 'clinic', home_visit: 'home_visit' };
  const aptTypeQuery = typeMap[selectedAptType] || '';
  const url = aptTypeQuery
    ? `${API}/doctors?type=${aptTypeQuery}`
    : `${API}/doctors`;

  try {
    const res  = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const docs = await res.json();
    statusEl.style.display = 'none';
    allLoadedDoctors = docs; // cache for clinic view

    if (!docs.length) { listEl.innerHTML = `<p class="loading-txt">No doctors available for <strong>${selectedAptType?.replace('_',' ') || 'this'}</strong> appointments right now.</p>`; return; }

    // ── Smart recommendation scoring ──
    const recommendedSpecs = getRecommendedSpecs(problem);
    const scored = docs.map(d => ({ d, score: scoreDoctor(d, recommendedSpecs) }));
    scored.sort((a, b) => b.score - a.score);

    const hasMatches   = scored.some(x => x.score > 0);
    const matchedDocs  = scored.filter(x => x.score > 0).map(x => x.d);
    const fallbackDocs = scored.filter(x => x.score === 0).map(x => x.d);

    // ── Recommendation banner ──
    let bannerHTML = '';
    if (problem && hasMatches) {
      const specLabels = [...new Set(
        matchedDocs.flatMap(d => d.specializations || [])
      )].slice(0, 3).join(', ');
      bannerHTML = `
        <div class="rec-banner">
          <i class="fas fa-magic"></i>
          <div>
            <strong>Smart Recommendation</strong>
            <span>Showing <strong>${matchedDocs.length}</strong> doctor${matchedDocs.length > 1 ? 's' : ''} matching your problem${specLabels ? ' · ' + specLabels : ''}</span>
          </div>
        </div>`;
    } else if (problem && !hasMatches) {
      bannerHTML = `
        <div class="rec-banner rec-banner-fallback">
          <i class="fas fa-search"></i>
          <div>
            <strong>Showing All Doctors</strong>
            <span>No exact specialization match found — showing all available doctors</span>
          </div>
        </div>`;
    }

    // ── Build ordered list: matched first, then fallback with divider ──
    const orderedDocs = hasMatches
      ? [...matchedDocs, ...fallbackDocs]
      : docs;

    let html = bannerHTML;

    orderedDocs.forEach((d, idx) => {
      // Section divider between matched and fallback
      if (hasMatches && problem && idx === matchedDocs.length && fallbackDocs.length) {
        html += `<div class="rec-divider"><span>Other Doctors</span></div>`;
      }

      const isMatched = hasMatches && idx < matchedDocs.length;
      const docJson   = encodeURIComponent(JSON.stringify(d));
      const specText  = d.specializations?.length ? d.specializations[0] : (d.medicalDegree || 'General Physician');

      const matchTag = isMatched
        ? `<span class="dc-match dc-match-smart"><i class="fas fa-magic"></i> Best match</span>`
        : (problem ? `<span class="dc-match dc-match-other"><i class="fas fa-user-md"></i> ${specText}</span>` : `<span class="dc-match"><i class="fas fa-user-md"></i> ${specText}</span>`);

      if (isHV) {
        html += `
          <div class="doctor-card-full hv-doctor${isMatched ? ' dc-recommended' : ''}" id="dc_${d._id}" onclick="selectHVDoctor(this,'${d._id}')">
            <div class="dcf-top">
              <div class="dc-avatar">${d.profilePhoto ? `<img src="${d.profilePhoto}">` : '<i class="fas fa-user-md"></i>'}</div>
              <div class="dc-info">
                <h4>Dr. ${d.firstName} ${d.lastName}</h4>
                <p>${d.medicalDegree || 'General Physician'}</p>
                ${matchTag}
              </div>
              <button class="dc-info-btn" onclick="event.stopPropagation(); showDoctorInfo('${docJson}')" title="View doctor details"><i class="fas fa-info-circle"></i></button>
              <div class="hv-available-badge"><i class="fas fa-circle"></i> Available</div>
              <div class="dc-check"><i class="fas fa-check-circle"></i></div>
            </div>
          </div>`;
      } else {
        html += `
          <div class="doctor-card-full${isMatched ? ' dc-recommended' : ''}" id="dc_${d._id}">
            <div class="dcf-top" onclick="selectNormalDoctor(this,'${d._id}')">
              <div class="dc-avatar">${d.profilePhoto ? `<img src="${d.profilePhoto}">` : '<i class="fas fa-user-md"></i>'}</div>
              <div class="dc-info">
                <h4>Dr. ${d.firstName} ${d.lastName}</h4>
                <p>${d.medicalDegree || 'General Physician'}</p>
                ${matchTag}
                <span class="dc-slot-tag"><i class="fas fa-calendar"></i> ${selectedDate} &bull; <i class="fas fa-clock"></i> ${selectedSlot}</span>
              </div>
              <button class="dc-info-btn" onclick="event.stopPropagation(); showDoctorInfo('${docJson}')" title="View doctor details"><i class="fas fa-info-circle"></i></button>
              <div class="dc-check"><i class="fas fa-check-circle"></i></div>
            </div>
          </div>`;
      }
    });

    listEl.innerHTML = html;
  } catch {
    statusEl.style.display = 'none';
    listEl.innerHTML = '<p class="loading-txt">Error loading doctors.</p>';
  }
}

// ── STEP 4 VIEW TOGGLE ──────────────────────────────────────────────
function switchStep4View(view) {
  step4View = view;
  selectedDoctorId = null;
  document.getElementById('step4Err').textContent = '';
  document.getElementById('toggleDoctor').classList.toggle('active', view === 'doctor');
  document.getElementById('toggleClinic').classList.toggle('active', view === 'clinic');
  document.getElementById('doctorsList').style.display = view === 'doctor' ? 'block' : 'none';
  document.getElementById('clinicList').style.display  = view === 'clinic' ? 'block' : 'none';
  if (view === 'clinic') renderClinicList();
}

function renderClinicList() {
  const el      = document.getElementById('clinicList');
  const clinics = allLoadedDoctors.filter(d => d.clinicName || d.clinicAddress);

  if (!clinics.length) {
    el.innerHTML = '<p class="loading-txt">No clinics available for this appointment type.</p>';
    return;
  }

  el.innerHTML = clinics.map(d => {
    const docJson = encodeURIComponent(JSON.stringify(d));
    const avail   = d.aptTypeAvailability?.clinic?.start && d.aptTypeAvailability?.clinic?.end
      ? `${d.aptTypeAvailability.clinic.start} – ${d.aptTypeAvailability.clinic.end}`
      : (d.availabilityStart && d.availabilityEnd
          ? `${d.availabilityStart} – ${d.availabilityEnd}` : 'Not specified');

    return `
      <div class="clinic-card" id="cc_${d._id}" onclick="selectClinic(this,'${d._id}')">
        <div class="clinic-card-inner">
          <div class="clinic-photo">
            ${d.clinicPhoto ? `<img src="${d.clinicPhoto}">` : '<i class="fas fa-hospital"></i>'}
          </div>
          <div class="clinic-info">
            <h4>${d.clinicName || 'Clinic'}</h4>
            <p><i class="fas fa-map-marker-alt" style="color:#667eea;margin-right:4px;"></i>${d.clinicAddress || 'Address not provided'}</p>
            <p style="margin-top:3px;"><i class="fas fa-clock" style="color:#27ae60;margin-right:4px;"></i>${avail}</p>
          </div>
          <button class="dc-info-btn" onclick="event.stopPropagation();showClinicInfo('${docJson}')" title="View details"><i class="fas fa-info-circle"></i></button>
          <div class="clinic-check"><i class="fas fa-check-circle"></i></div>
        </div>
      </div>`;
  }).join('');
}

function selectClinic(el, doctorId) {
  document.querySelectorAll('.clinic-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedDoctorId = doctorId;
  document.getElementById('step4Err').textContent = '';
}

function showClinicInfo(docJson) {
  const d    = JSON.parse(decodeURIComponent(docJson));
  const name = `Dr. ${d.firstName || ''} ${d.lastName || ''}`.trim();
  const avail = d.aptTypeAvailability?.clinic?.start && d.aptTypeAvailability?.clinic?.end
    ? `${d.aptTypeAvailability.clinic.start} – ${d.aptTypeAvailability.clinic.end}`
    : (d.availabilityStart && d.availabilityEnd
        ? `${d.availabilityStart} – ${d.availabilityEnd}` : 'Not specified');

  document.getElementById('dinfoName').textContent   = d.clinicName || 'Clinic';
  document.getElementById('dinfoDegree').textContent = name;

  const avatarEl = document.getElementById('dinfoAvatar');
  avatarEl.innerHTML = d.clinicPhoto
    ? `<img src="${d.clinicPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : '<i class="fas fa-hospital"></i>';

  document.getElementById('dinfoBody').innerHTML = `
    <div class="dinfo-grid">
      <div class="dinfo-item">
        <i class="fas fa-user-md"></i>
        <div><span>Doctor</span><strong>${name}</strong></div>
      </div>
      <div class="dinfo-item">
        <i class="fas fa-graduation-cap"></i>
        <div><span>Qualification</span><strong>${d.medicalDegree || 'N/A'}</strong></div>
      </div>
    </div>
    <div class="dinfo-section">
      <div class="dinfo-label"><i class="fas fa-map-marker-alt"></i> Clinic Address</div>
      <p class="dinfo-address">${d.clinicAddress || 'Not provided'}</p>
    </div>
    <div class="dinfo-section">
      <div class="dinfo-label"><i class="fas fa-clock"></i> Clinic Availability</div>
      <div class="dinfo-avail-grid">
        <div class="dinfo-avail-overall">
          <i class="fas fa-clock"></i><span>Hours</span><strong>${avail}</strong>
        </div>
      </div>
    </div>`;

  document.getElementById('doctorInfoModal').classList.add('open');
}

// ── DOCTOR INFO MODAL (Step 4) ──────────────────────────
function showDoctorInfo(docJson) {
  const d = JSON.parse(decodeURIComponent(docJson));
  const name = `Dr. ${d.firstName || ''} ${d.lastName || ''}`.trim();

  document.getElementById('dinfoName').textContent   = name;
  document.getElementById('dinfoDegree').textContent = d.medicalDegree || 'General Physician';

  const avatarEl = document.getElementById('dinfoAvatar');
  avatarEl.innerHTML = d.profilePhoto
    ? `<img src="${d.profilePhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : '<i class="fas fa-user-md"></i>';

  const aptTypeLabels = { online: 'Online', home_visit: 'Home Visit', clinic: 'Clinic' };
  const aptTypeIcons  = { online: 'fa-video', home_visit: 'fa-house-medical', clinic: 'fa-hospital' };

  // ── Specializations ──
  const specs = d.specializations?.length
    ? d.specializations.map(s => `<span class="dinfo-tag">${s}</span>`).join('')
    : '<span class="dinfo-na"><i class="fas fa-info-circle"></i> No specialization added</span>';

  // ── Available Appointment Types ──
  const aptTypes = d.appointmentTypes?.length
    ? d.appointmentTypes.map(t => `
        <span class="dinfo-apt-tag">
          <i class="fas ${aptTypeIcons[t] || 'fa-calendar'}"></i> ${aptTypeLabels[t] || t}
        </span>`).join('')
    : '<span class="dinfo-na"><i class="fas fa-info-circle"></i> No appointment types added</span>';

  // ── Availability ──
  // Overall availability row
  let overallRow = '';
  if (d.availabilityStart && d.availabilityEnd) {
    overallRow = `
      <div class="dinfo-avail-overall">
        <i class="fas fa-clock"></i>
        <span>Overall</span>
        <strong>${d.availabilityStart} – ${d.availabilityEnd}</strong>
      </div>`;
  }

  // Per-type availability rows
  let perTypeRows = '';
  if (d.aptTypeAvailability) {
    const rows = (d.appointmentTypes || []).map(type => {
      const v = d.aptTypeAvailability[type];
      if (!v?.start || !v?.end) return '';
      return `
        <div class="dinfo-avail-row">
          <i class="fas ${aptTypeIcons[type] || 'fa-clock'}"></i>
          <span>${aptTypeLabels[type] || type}</span>
          <strong>${v.start} – ${v.end}</strong>
        </div>`;
    }).filter(Boolean);
    if (rows.length) perTypeRows = rows.join('');
  }

  let availHTML = '';
  if (overallRow || perTypeRows) {
    availHTML = `<div class="dinfo-avail-grid">${overallRow}${perTypeRows}</div>`;
  } else {
    availHTML = '<span class="dinfo-na"><i class="fas fa-info-circle"></i> No availability set</span>';
  }

  document.getElementById('dinfoBody').innerHTML = `
    <div class="dinfo-grid">
      <div class="dinfo-item">
        <i class="fas fa-graduation-cap"></i>
        <div><span>Qualification</span><strong>${d.medicalDegree || 'N/A'}</strong></div>
      </div>
      <div class="dinfo-item">
        <i class="fas fa-calendar-check"></i>
        <div><span>Year of Completion</span><strong>${d.yearOfCompletion || 'N/A'}</strong></div>
      </div>
    </div>
    <div class="dinfo-section">
      <div class="dinfo-label"><i class="fas fa-stethoscope"></i> Specializations</div>
      <div class="dinfo-tags">${specs}</div>
    </div>
    <div class="dinfo-section">
      <div class="dinfo-label"><i class="fas fa-calendar-alt"></i> Available Appointment Types</div>
      <div class="dinfo-tags">${aptTypes}</div>
    </div>
    <div class="dinfo-section">
      <div class="dinfo-label"><i class="fas fa-clock"></i> Availability</div>
      ${availHTML}
    </div>
    ${d.clinicAddress ? `
    <div class="dinfo-section">
      <div class="dinfo-label"><i class="fas fa-hospital"></i> Clinic Address</div>
      <p class="dinfo-address">${d.clinicAddress}</p>
    </div>` : ''}
  `;

  document.getElementById('doctorInfoModal').classList.add('open');
}

function closeDoctorInfoModal() {
  document.getElementById('doctorInfoModal').classList.remove('open');
}

document.getElementById('doctorInfoModal').addEventListener('click', e => {
  if (e.target === document.getElementById('doctorInfoModal')) closeDoctorInfoModal();
});

function selectNormalDoctor(el, id) {
  document.querySelectorAll('.doctor-card-full').forEach(c => c.classList.remove('selected'));
  el.closest('.doctor-card-full').classList.add('selected');
  selectedDoctorId = id;
  document.getElementById('step4Err').textContent = '';
}

function selectHVDoctor(el, id) {
  document.querySelectorAll('.hv-doctor').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedDoctorId = id;
  // For emergency home visit use today's date and an immediate slot
  selectedDate = new Date().toISOString().split('T')[0];
  selectedSlot = 'As soon as possible';
  document.getElementById('step4Err').textContent = '';
}

function toggleDoctorSlots(docId) {
  const slots = document.getElementById(`dcSlots_${docId}`);
  const arrow = document.getElementById(`dcArrow_${docId}`);
  const isOpen = slots.style.display !== 'none';
  // close all others
  document.querySelectorAll('.dcf-slots').forEach(el => el.style.display = 'none');
  document.querySelectorAll('[id^="dcArrow_"]').forEach(el => el.style.transform = '');
  document.querySelectorAll('.doctor-card-full').forEach(el => el.classList.remove('selected'));
  if (!isOpen) {
    slots.style.display = 'block';
    arrow.style.transform = 'rotate(180deg)';
    document.getElementById(`dc_${docId}`).classList.add('selected');
    selectedDoctorId = docId;
    selectedSlot = null; selectedDate = null;
    document.getElementById('step4Err').textContent = '';
  } else {
    selectedDoctorId = null;
  }
}

function selectDoctorDate(docId) {
  if (selectedDoctorId === docId) selectedDate = document.getElementById(`dcDate_${docId}`).value;
}

function selectSlot(el, docId) {
  document.querySelectorAll(`.slot-chip[data-doc="${docId}"]`).forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedSlot = el.dataset.slot;
  document.getElementById('step4Err').textContent = '';
}

// ── SUBMIT BOOKING ────────────────────────────────────────
async function submitBooking() {
  const err = document.getElementById('step4Err');
  if (!selectedDoctorId) { err.textContent = 'Please select a doctor.'; return; }

  // Validate date + time
  if (!selectedDate || !selectedSlot) {
    err.textContent = 'Please select date and time before confirming.'; return;
  }
  const appointmentDateTime = parseDateAndTime(selectedDate, selectedSlot);
  if (isNaN(appointmentDateTime.getTime())) {
    err.textContent = 'Invalid date selected. Please go back and pick a valid date.'; return;
  }

  err.textContent = '';

  const fd = new FormData();
  fd.append('name',             document.getElementById('s1_name').value.trim());
  fd.append('age',              document.getElementById('s1_age').value);
  fd.append('gender',           document.getElementById('s1_gender').value);
  fd.append('relation',         document.getElementById('s1_relation').value);
  fd.append('bloodGroup',       document.getElementById('s1_bloodGroup').value);
  fd.append('presentAddress',   document.getElementById('s1_address').value.trim());
  fd.append('appointmentType',  selectedAptType);
  fd.append('appointmentDate',  appointmentDateTime.toISOString());
  fd.append('timeSlot',         selectedSlot);
  fd.append('healthProblem',    document.getElementById('s3_healthProblem').value.trim());
  fd.append('currentTreatment', document.getElementById('s3_currentTreatment').value.trim());
  uploadedFiles.forEach(f => fd.append('medicalReports', f));
  selectedExistingRx.forEach(r => fd.append('existingReportPaths', r.filePath));
  fd.append('doctorId', selectedDoctorId);

  try {
    const res  = await fetch(`${API}/book`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('step4').style.display = 'none';
      document.getElementById('wp4').classList.add('done');
      const isHV = selectedAptType === 'home_visit' && selectedHomeVisitType === 'doctor';
      if (isHV) {
        document.getElementById('successTitle').textContent = 'Home Visit Requested!';
        document.getElementById('successMsg').textContent  = 'Your emergency home visit request has been sent.\nThe nearest doctor will be dispatched shortly.';
      } else {
        document.getElementById('successTitle').textContent = 'Appointment Booked!';
        document.getElementById('successMsg').innerHTML    = 'Your appointment request has been sent to the doctor.<br>You\'ll be notified once it\'s confirmed.';
      }
      document.getElementById('stepSuccess').style.display = 'block';
      await loadAll();
    } else {
      err.textContent = data.error || 'Booking failed.';
    }
  } catch {
    err.textContent = 'Server error. Please try again.';
  }
}

// ── NURSE VISIT ──────────────────────────────────────────
let selectedNurseId   = null;
let selectedNurseSlot = null;
let snHour = 9, snMin = 0, snAmPm = 'AM';

function changeNurseTime(part, dir) {
  if (part === 'hour') {
    snHour = ((snHour - 1 + dir + 12) % 12) + 1;
    document.getElementById('snHour').textContent = String(snHour).padStart(2,'0');
  } else if (part === 'min') {
    snMin = (snMin + dir * 5 + 60) % 60;
    document.getElementById('snMin').textContent = String(snMin).padStart(2,'0');
  } else {
    snAmPm = snAmPm === 'AM' ? 'PM' : 'AM';
    document.getElementById('snAmPm').textContent = snAmPm;
  }
}

function getNurseTime() {
  return `${String(snHour).padStart(2,'0')}:${String(snMin).padStart(2,'0')} ${snAmPm}`;
}

function resetNurseTimeSpinner() {
  snHour = 9; snMin = 0; snAmPm = 'AM';
  document.getElementById('snHour').textContent = '09';
  document.getElementById('snMin').textContent  = '00';
  document.getElementById('snAmPm').textContent = 'AM';
}

function backFromNurse() {
  document.getElementById('stepNurse').style.display = 'none';
  document.getElementById('wp2').classList.remove('done');
  document.getElementById('wp2').classList.add('active');
  document.getElementById('step2').style.display = 'block';
  currentStep = 2;
}

function backToNurseForm() {
  document.getElementById('nurseResultsPanel').style.display = 'none';
  document.getElementById('nurseFormPanel').style.display = 'block';
  selectedNurseId = null;
}

function selectNurseSlot(el) {
  document.querySelectorAll('#nurseFormPanel .slot-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedNurseSlot = el.dataset.slot;
  document.getElementById('stepNurseErr').textContent = '';
}

async function searchNurses() {
  const err     = document.getElementById('stepNurseErr');
  const problem = document.getElementById('sn_healthProblem').value.trim();
  const gender  = document.querySelector('input[name="nurseGender"]:checked')?.value || 'Any';
  const date    = document.getElementById('sn_date').value;
  const time    = getNurseTime();

  if (!problem) { err.textContent = 'Please describe the service needed.'; return; }
  if (!date)    { err.textContent = 'Please select a preferred date.'; return; }
  err.textContent = '';

  selectedNurseSlot = `${date} ${time}`;

  const listEl = document.getElementById('nurseList');
  listEl.innerHTML = '<p class="loading-txt"><i class="fas fa-spinner fa-spin"></i> Searching nurses...</p>';
  document.getElementById('nurseFormPanel').style.display = 'none';
  document.getElementById('nurseResultsPanel').style.display = 'block';
  document.getElementById('nurseResultsSub').textContent =
    `${gender === 'Any' ? 'All' : gender} nurses available on ${date} at ${time}`;
  selectedNurseId = null;

  try {
    const res   = await fetch(`${API}/nurses?gender=${encodeURIComponent(gender)}&time=${encodeURIComponent(time)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const nurses = await res.json();

    if (!nurses.length) {
      listEl.innerHTML = '<p class="loading-txt">No nurses available for the selected slot. Try a different time.</p>';
      return;
    }

    listEl.innerHTML = nurses.map(n => `
      <div class="nurse-card" id="nc_${n._id}" onclick="selectNurse(this,'${n._id}')">
        <div class="nc-avatar ${n.gender === 'Female' ? 'female' : 'male'}">
          ${(n.photo || n.profilePhoto) ? `<img src="${n.photo || n.profilePhoto}">` : `<i class="fas fa-user-nurse"></i>`}
        </div>
        <div class="nc-info">
          <h4>${n.name}</h4>
          <p><i class="fas fa-venus-mars"></i> ${n.gender} &nbsp;&bull;&nbsp;
             <i class="fas fa-briefcase-medical"></i> ${n.experience} yr${n.experience !== 1 ? 's' : ''} exp</p>
          <p class="nc-speciality"><i class="fas fa-stethoscope"></i> ${n.speciality || 'General Nursing'}</p>
        </div>
        <div class="nc-right">
          <span class="nc-available"><i class="fas fa-circle"></i> Available</span>
          <div class="nc-check"><i class="fas fa-check-circle"></i></div>
        </div>
      </div>`).join('');
  } catch {
    listEl.innerHTML = '<p class="loading-txt">Error searching nurses. Please try again.</p>';
  }
}

function selectNurse(el, id) {
  document.querySelectorAll('.nurse-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedNurseId = id;
  document.getElementById('stepNurseConfirmErr').textContent = '';
}

async function confirmNurseBooking() {
  const err = document.getElementById('stepNurseConfirmErr');
  if (!selectedNurseId) { err.textContent = 'Please select a nurse.'; return; }
  err.textContent = '';

  const body = {
    name:          document.getElementById('s1_name').value.trim(),
    age:           document.getElementById('s1_age').value,
    gender:        document.getElementById('s1_gender').value,
    relation:      document.getElementById('s1_relation').value,
    bloodGroup:    document.getElementById('s1_bloodGroup').value,
    presentAddress:document.getElementById('s1_address').value.trim(),
    healthProblem: document.getElementById('sn_healthProblem').value.trim(),
    nurseId:       selectedNurseId,
    timeSlot:      selectedNurseSlot,
    nurseGender:   document.querySelector('input[name="nurseGender"]:checked')?.value
  };

  try {
    const res  = await fetch(`${API}/book-nurse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('stepNurse').style.display = 'none';
      document.getElementById('successTitle').textContent = 'Nurse Visit Booked!';
      document.getElementById('successMsg').innerHTML =
        `Your nurse visit has been confirmed for <strong>${selectedNurseSlot}</strong>.<br>The nurse will arrive at your address shortly.`;
      document.getElementById('stepSuccess').style.display = 'block';
      await loadAll();
    } else {
      err.textContent = data.error || 'Booking failed.';
    }
  } catch {
    err.textContent = 'Server error. Please try again.';
  }
}
function logout() {
  ['patientToken','patientMobile','patientProfile'].forEach(k => localStorage.removeItem(k));
  window.location.href = 'login.html';
}

init();
