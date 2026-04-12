const API_URL = 'http://localhost:3000/api/nurse';
let appointments = [];
let currentFilter = 'none';

function getToken() { return localStorage.getItem('nurseToken'); }

if (!getToken()) window.location.href = 'login.html';

// ── PROFILE ───────────────────────────────────────────────
async function loadNurseProfile() {
  try {
    const res = await fetch(`${API_URL}/profile`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) return;

    const nurse = await res.json();

    if (!nurse.isProfileComplete) {
      window.location.href = 'nurse-profile.html'; return;
    }

    document.getElementById('nurseName').textContent   = nurse.name || 'Nurse';
    document.getElementById('nursePdName').textContent = nurse.name || 'Nurse';
    document.getElementById('nursePdQual').textContent = nurse.qualification || '';
    if (nurse.profilePhoto) document.getElementById('nursePhoto').src = nurse.profilePhoto;
  } catch (e) { console.error('Profile load error:', e); }
}

function toggleProfileMenu() {
  document.getElementById('nurseProfileDropdown').classList.toggle('open');
}

function openProfileOverlay() {
  document.getElementById('nurseProfileDropdown').classList.remove('open');
  document.getElementById('profileFrame').src = 'nurse-profile.html';
  document.getElementById('profileOverlay').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeProfileOverlay() {
  document.getElementById('profileOverlay').style.display = 'none';
  document.getElementById('profileFrame').src = '';
  document.body.style.overflow = '';
  loadNurseProfile();
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('profileOverlay')) closeProfileOverlay();
}

// ── APPOINTMENTS ──────────────────────────────────────────
async function loadAppointments() {
  try {
    const res = await fetch(`${API_URL}/appointments`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) return;

    appointments = await res.json();
    updateStats();
    if (currentFilter !== 'none') displayAppointments(currentFilter);
    buildNotifications();
  } catch (e) {
    document.getElementById('appointmentsList').innerHTML = '<p class="error">Error loading appointments</p>';
  }
}

function updateStats() {
  document.getElementById('pendingCount').textContent   = appointments.filter(a => a.status === 'pending').length;
  document.getElementById('confirmedCount').textContent = appointments.filter(a => a.status === 'confirmed').length;
  document.getElementById('totalCount').textContent     = appointments.length;
}

function filterByStatus(status) {
  currentFilter = status;
  document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('stat-active'));
  const map = { pending: 0, confirmed: 1, all: 2 };
  const cards = document.querySelectorAll('.stat-card');
  if (cards[map[status]]) cards[map[status]].classList.add('stat-active');
  displayAppointments(status);
}

function displayAppointments(filter) {
  const listEl = document.getElementById('appointmentsList');
  const list = filter === 'all' ? appointments : appointments.filter(a => a.status === filter);

  if (!list.length) {
    listEl.innerHTML = `<p class="no-data">No ${filter === 'all' ? '' : filter} appointments</p>`;
    return;
  }

  listEl.innerHTML = list.map(apt => {
    const patientName = apt.patientId
      ? (apt.patientId.name || `${apt.patientId.firstName || ''} ${apt.patientId.lastName || ''}`.trim() || 'Patient')
      : 'Patient';
    const canCancel = apt.status === 'confirmed' && new Date(apt.autoConfirmTimer) > new Date();
    const isLocked  = apt.status === 'confirmed' && new Date(apt.autoConfirmTimer) <= new Date();

    return `
      <div class="appointment-card ${apt.status}" onclick="viewPatient('${apt._id}')">
        <div class="apt-header">
          <div class="patient-info">
            <i class="fas fa-user-circle"></i>
            <div>
              <h3>${patientName}</h3>
              <p>${apt.patientId?.mobile || ''}</p>
            </div>
          </div>
          <span class="status-badge ${apt.status}">${apt.status.toUpperCase()}</span>
        </div>

        <div class="apt-details">
          <div class="detail-item">
            <i class="fas fa-calendar"></i>
            <span>${apt.appointmentDate ? new Date(apt.appointmentDate).toLocaleDateString() : '—'}</span>
          </div>
          <div class="detail-item">
            <i class="fas fa-clock"></i>
            <span>${apt.timeSlot || '—'}</span>
          </div>
          <div class="detail-item">
            <i class="fas fa-notes-medical"></i>
            <span>${apt.healthProblem || 'Not specified'}</span>
          </div>
        </div>

        <div class="apt-actions" onclick="event.stopPropagation()">
          ${apt.status === 'pending' ? `
            <button class="btn-confirm" onclick="confirmAppointment('${apt._id}')">
              <i class="fas fa-check"></i> Confirm
            </button>
            <button class="btn-cancel" onclick="cancelAppointment('${apt._id}')">
              <i class="fas fa-times"></i> Cancel
            </button>
          ` : ''}
          ${canCancel ? `
            <button class="btn-cancel" onclick="cancelAppointment('${apt._id}')">
              <i class="fas fa-times"></i> Cancel
            </button>
            <small class="timer">Can cancel for ${getRemainingTime(apt.autoConfirmTimer)}</small>
          ` : ''}
          ${isLocked ? `<small class="locked"><i class="fas fa-lock"></i> Locked</small>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function getRemainingTime(timerDate) {
  const remaining = Math.max(0, Math.floor((new Date(timerDate) - new Date()) / 1000));
  return `${remaining}s`;
}

async function confirmAppointment(id) {
  try {
    const res = await fetch(`${API_URL}/appointments/${id}/confirm`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (res.ok) {
      await loadAppointments();
      setTimeout(() => loadAppointments(), 30000);
    } else {
      const d = await res.json();
      alert(d.error || 'Error confirming appointment');
    }
  } catch { alert('Error confirming appointment'); }
}

async function cancelAppointment(id) {
  if (!confirm('Are you sure you want to cancel this appointment?')) return;
  try {
    const res = await fetch(`${API_URL}/appointments/${id}/cancel`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (res.ok) await loadAppointments();
    else alert(data.error);
  } catch { alert('Error cancelling appointment'); }
}

async function viewPatient(appointmentId) {
  try {
    const apt = appointments.find(a => a._id === appointmentId);
    if (!apt) return;
    const p = apt.patientId;
    const patientName = p
      ? (p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Patient')
      : 'Patient';

    document.getElementById('patientDetails').innerHTML = `
      <div class="patient-card">
        <h3>${patientName}</h3>
        <div class="patient-info-grid">
          <div><strong>Age:</strong> ${p?.age || 'N/A'}</div>
          <div><strong>Gender:</strong> ${p?.gender || 'N/A'}</div>
          <div><strong>Mobile:</strong> ${p?.mobile || 'N/A'}</div>
        </div>
        <div class="health-problem">
          <strong>Health Problem:</strong>
          <p>${apt.healthProblem || 'Not specified'}</p>
        </div>
        <div class="appointment-info">
          <strong>Appointment:</strong> ${apt.appointmentDate ? new Date(apt.appointmentDate).toLocaleDateString() : '—'} at ${apt.timeSlot || '—'}
          &nbsp;&bull;&nbsp; <strong>Status:</strong> ${apt.status || '—'}
        </div>
      </div>
    `;
    document.getElementById('patientModal').style.display = 'block';
  } catch { alert('Error loading patient details'); }
}

function closeModal() { document.getElementById('patientModal').style.display = 'none'; }

function showSection(section) {
  document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`${section}Section`).style.display = 'block';
  if (event?.target) {
    const navItem = event.target.closest('.nav-item');
    if (navItem) navItem.classList.add('active');
  }
}

function logout() {
  localStorage.removeItem('nurseToken');
  localStorage.removeItem('nurseReadNotifs');
  window.location.href = 'login.html';
}

// Close dropdown on outside click
document.addEventListener('click', e => {
  const wrap = document.getElementById('nurseProfileBtn');
  const drop = document.getElementById('nurseProfileDropdown');
  if (drop && !drop.contains(e.target) && !wrap.contains(e.target))
    drop.classList.remove('open');
});

// ── NOTIFICATIONS ─────────────────────────────────────────
let nurseReadNotifIds = JSON.parse(localStorage.getItem('nurseReadNotifs') || '[]');

function buildNotifications() {
  const notifs = [];
  appointments.forEach(a => {
    const patientName = a.patientId
      ? (a.patientId.name || `${a.patientId.firstName || ''} ${a.patientId.lastName || ''}`.trim() || 'Patient')
      : 'Patient';
    const date = a.updatedAt || a.createdAt || '';
    if (a.status === 'pending')
      notifs.push({ id: `apt-pending-${a._id}`, icon: 'fa-calendar-plus', color: '#f7971e',
        filter: 'pending', text: `New appointment request from <strong>${patientName}</strong>.`, date });
    else if (a.status === 'confirmed')
      notifs.push({ id: `apt-confirmed-${a._id}`, icon: 'fa-check-circle', color: '#11998e',
        filter: 'confirmed', text: `Appointment with <strong>${patientName}</strong> confirmed.`, date });
    else if (a.status === 'cancelled')
      notifs.push({ id: `apt-cancelled-${a._id}`, icon: 'fa-times-circle', color: '#e74c3c',
        filter: 'all', text: `Appointment with <strong>${patientName}</strong> was cancelled.`, date });
  });
  notifs.sort((a, b) => new Date(b.date) - new Date(a.date));

  const unread = notifs.filter(n => !nurseReadNotifIds.includes(n.id)).length;
  const badge  = document.getElementById('notifBadge');
  badge.textContent   = unread;
  badge.style.display = unread > 0 ? 'flex' : 'none';

  const listEl = document.getElementById('notifList');
  if (!notifs.length) {
    listEl.innerHTML = '<p class="notif-empty"><i class="fas fa-bell-slash"></i><br>No notifications yet</p>';
    return;
  }
  listEl.innerHTML = notifs.map(n => `
    <div class="notif-item ${nurseReadNotifIds.includes(n.id) ? 'read' : 'unread'}" onclick="navigateFromNotif('${n.filter}','${n.id}')">
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

function navigateFromNotif(filter, notifId) {
  if (!nurseReadNotifIds.includes(notifId)) {
    nurseReadNotifIds.push(notifId);
    localStorage.setItem('nurseReadNotifs', JSON.stringify(nurseReadNotifIds));
  }
  document.getElementById('notifPanel').classList.remove('open');
  buildNotifications();
  filterByStatus(filter);
}

function toggleNotifPanel() {
  document.getElementById('notifPanel').classList.toggle('open');
  document.addEventListener('click', function handler(e) {
    if (!document.getElementById('notifPanel').contains(e.target) &&
        !document.getElementById('notifBtn').contains(e.target)) {
      document.getElementById('notifPanel').classList.remove('open');
      document.removeEventListener('click', handler);
    }
  });
}

function clearNotifications() {
  appointments.forEach(a => {
    ['pending', 'confirmed', 'cancelled'].forEach(s => {
      const id = `apt-${s}-${a._id}`;
      if (!nurseReadNotifIds.includes(id)) nurseReadNotifIds.push(id);
    });
  });
  localStorage.setItem('nurseReadNotifs', JSON.stringify(nurseReadNotifIds));
  buildNotifications();
}

loadNurseProfile();
loadAppointments();
setInterval(loadAppointments, 10000);
