const API_URL = 'http://localhost:3000/api/doctor';
let appointments = [];

function getToken() {
  return localStorage.getItem('doctorToken');
}

if (!getToken()) {
  window.location.href = 'login.html';
}

async function loadDoctorProfile() {
  try {
    const response = await fetch(`${API_URL}/profile`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (response.status === 401) { logout(); return; }
    if (!response.ok) { console.error('Profile load failed:', response.status); return; }

    const doctor = await response.json();

    const fullName = `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim();
    document.getElementById('doctorName').textContent = fullName || 'Doctor';
    document.getElementById('drPdName').textContent   = `Dr. ${fullName}`;
    document.getElementById('drPdDegree').textContent = doctor.medicalDegree || '';

    if (doctor.profilePhoto) {
      document.getElementById('doctorPhoto').src = doctor.profilePhoto;
    }

    if (!doctor.isProfileComplete) {
      window.location.href = 'doctor-profile.html';
      return;
    }

    displayProfile(doctor);
    _cachedDoctor = doctor;
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

function toggleDrProfileMenu() {
  document.getElementById('drProfileDropdown').classList.toggle('open');
}

function showProfileFromDropdown() {
  document.getElementById('drProfileDropdown').classList.remove('open');
  openProfileOverlay();
}

function openProfileOverlay() {
  document.getElementById('drProfileDropdown').classList.remove('open');
  document.getElementById('profileFrame').src = 'doctor-profile.html';
  document.getElementById('profileOverlay').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeProfileOverlay() {
  document.getElementById('profileOverlay').style.display = 'none';
  document.getElementById('profileFrame').src = '';
  document.body.style.overflow = '';
  loadDoctorProfile();
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('profileOverlay')) closeProfileOverlay();
}

async function loadAppointments() {
  try {
    const response = await fetch(`${API_URL}/appointments`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (response.status === 401) { logout(); return; }
    if (!response.ok) { console.error('Appointments load failed:', response.status); return; }

    appointments = await response.json();
    updateStats();
    if (currentFilter !== 'none') displayAppointments(currentFilter);
    buildDoctorNotifications();
  } catch (error) {
    console.error('Error loading appointments:', error);
    document.getElementById('appointmentsList').innerHTML = '<p class="error">Error loading appointments</p>';
  }
}

function updateStats() {
  const pending = appointments.filter(a => a.status === 'pending').length;
  const confirmed = appointments.filter(a => a.status === 'confirmed').length;
  
  document.getElementById('pendingCount').textContent = pending;
  document.getElementById('confirmedCount').textContent = confirmed;
  document.getElementById('totalCount').textContent = appointments.length;
}

let currentFilter = 'none'; // 'none' = empty on load

function filterByStatus(status) {
  currentFilter = status;
  // Highlight active stat card
  document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('stat-active'));
  const map = { pending: 0, confirmed: 1, all: 2 };
  const cards = document.querySelectorAll('.stat-card');
  if (cards[map[status]]) cards[map[status]].classList.add('stat-active');
  displayAppointments(status);
}

function displayAppointments(filter = currentFilter) {
  const listEl = document.getElementById('appointmentsList');
  const list = filter === 'all'
    ? appointments
    : appointments.filter(a => a.status === filter);

  if (!list.length) {
    listEl.innerHTML = `<p class="no-data">No ${filter === 'all' ? '' : filter} appointments</p>`;
    return;
  }

  const html = list.map(apt => {
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
          ${isLocked ? `
            <small class="locked"><i class="fas fa-lock"></i> Locked</small>
          ` : ''}
          ${apt.status === 'confirmed' && apt.appointmentType === 'online' && isWithinJoinWindowDoctor(apt.appointmentDate, apt.timeSlot) ? `
            <button class="btn-join-call" onclick="joinConsultationDoctor('${apt._id}')">
              <i class="fas fa-video"></i> Join
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  listEl.innerHTML = html;
}

function getRemainingTime(timerDate) {
  const remaining = Math.max(0, Math.floor((new Date(timerDate) - new Date()) / 1000));
  return `${remaining}s`;
}

async function confirmAppointment(id) {
  try {
    const response = await fetch(`${API_URL}/appointments/${id}/confirm`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (response.ok) {
      await loadAppointments();
      setTimeout(() => loadAppointments(), 30000);
    }
  } catch (error) {
    alert('Error confirming appointment');
  }
}

async function cancelAppointment(id) {
  if (!confirm('Are you sure you want to cancel this appointment?')) return;

  try {
    const response = await fetch(`${API_URL}/appointments/${id}/cancel`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();
    
    if (response.ok) {
      await loadAppointments();
    } else {
      alert(data.error);
    }
  } catch (error) {
    alert('Error cancelling appointment');
  }
}

async function viewPatient(appointmentId) {
  try {
    const response = await fetch(`${API_URL}/patient/${appointmentId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await response.json();
    
    const patientName = data.patient
      ? (data.patient.name || `${data.patient.firstName || ''} ${data.patient.lastName || ''}`.trim() || 'Patient')
      : 'Patient';

    const reportsHTML = (data.medicalReports && data.medicalReports.length)
      ? data.medicalReports.map(r => {
          const isImg = /\.(jpg|jpeg|png|gif)$/i.test(r);
          return isImg
            ? `<a href="${r}" target="_blank"><img src="${r}" style="max-width:80px;max-height:80px;border-radius:6px;border:1px solid #ddd;"></a>`
            : `<a href="${r}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#fdecea;color:#e74c3c;border-radius:6px;font-size:12px;text-decoration:none;"><i class="fas fa-file-pdf"></i> Report</a>`;
        }).join(' ')
      : '<span style="color:#aaa;font-size:13px;">No reports uploaded</span>';

    const html = `
      <div class="patient-card">
        <h3>${patientName}</h3>
        <div class="patient-info-grid">
          <div><strong>Age:</strong> ${data.patient?.age || 'N/A'}</div>
          <div><strong>Gender:</strong> ${data.patient?.gender || 'N/A'}</div>
          <div><strong>Mobile:</strong> ${data.patient?.mobile || 'N/A'}</div>
          <div><strong>Email:</strong> ${data.patient?.email || 'N/A'}</div>
          <div><strong>Address:</strong> ${data.patient?.address || 'N/A'}</div>
          <div><strong>Blood Group:</strong> ${data.patient?.bloodGroup || 'N/A'}</div>
        </div>
        <div class="health-problem">
          <strong>Health Problem:</strong>
          <p>${data.healthProblem || 'Not specified'}</p>
        </div>
        ${data.currentTreatment ? `
        <div class="health-problem">
          <strong>Current Treatment:</strong>
          <p>${data.currentTreatment}</p>
        </div>` : ''}
        <div class="health-problem">
          <strong>Medical Reports:</strong>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">${reportsHTML}</div>
        </div>
        <div class="appointment-info">
          <strong>Appointment:</strong> ${data.appointmentDate ? new Date(data.appointmentDate).toLocaleDateString() : '—'} at ${data.timeSlot || '—'}
          &nbsp;&bull;&nbsp; <strong>Status:</strong> ${data.status || '—'}
        </div>
      </div>
    `;
    
    document.getElementById('patientDetails').innerHTML = html;
    document.getElementById('patientModal').style.display = 'block';
  } catch (error) {
    alert('Error loading patient details');
  }
}

function closeModal() {
  document.getElementById('patientModal').style.display = 'none';
}

function showSection(section) {
  document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`${section}Section`).style.display = 'block';
  if (event && event.target) {
    const navItem = event.target.closest('.nav-item');
    if (navItem) navItem.classList.add('active');
  }
  if (section === 'messages') populateMsgDropdown();
}

function logout() {
  localStorage.removeItem('doctorToken');
  localStorage.removeItem('doctorReadNotifs');
  window.location.href = 'login.html';
}

loadDoctorProfile();
loadAppointments();
setInterval(loadAppointments, 10000);

// ── ONLINE CONSULTATION (DOCTOR) ──────────────────────────────────────────
function isWithinJoinWindowDoctor(aptDate, timeSlot) {
  if (!aptDate || !timeSlot) return false;
  try {
    const slotStart = timeSlot.split('–')[0].trim();
    const [time, ap] = slotStart.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    const date = new Date(aptDate);
    date.setHours(h, m, 0, 0);
    const diff = (date - new Date()) / 60000;
    return diff <= 10 && diff >= -60;
  } catch { return false; }
}

function joinConsultationDoctor(aptId) {
  const apt    = appointments.find(a => a._id === aptId);
  const drName = document.getElementById('doctorName').textContent || 'Doctor';
  const name   = encodeURIComponent(`Dr. ${drName}`);
  window.open(`consultation.html?appointmentId=${aptId}&role=doctor&name=${name}`, '_blank');
}

// ── NOTIFICATIONS (DOCTOR) ─────────────────────────────────
let drReadNotifIds = JSON.parse(localStorage.getItem('doctorReadNotifs') || '[]');

function buildDoctorNotifications() {
  const notifs = [];
  appointments.forEach(a => {
    const patientName = a.patientId
      ? (a.patientId.name || `${a.patientId.firstName||''} ${a.patientId.lastName||''}`.trim() || 'Patient')
      : 'Patient';
    const date = a.updatedAt || a.createdAt || '';
    if (a.status === 'pending')
      notifs.push({ id: `apt-pending-${a._id}`, icon: 'fa-calendar-plus', color: '#f7971e', section: 'appointments',
        text: `New appointment request from <strong>${patientName}</strong>.`, date });
    else if (a.status === 'confirmed')
      notifs.push({ id: `apt-confirmed-${a._id}`, icon: 'fa-check-circle', color: '#11998e', section: 'appointments',
        text: `Appointment with <strong>${patientName}</strong> confirmed.`, date });
    else if (a.status === 'cancelled')
      notifs.push({ id: `apt-cancelled-${a._id}`, icon: 'fa-times-circle', color: '#e74c3c', section: 'appointments',
        text: `Appointment with <strong>${patientName}</strong> was cancelled.`, date });
  });
  notifs.sort((a, b) => new Date(b.date) - new Date(a.date));
  const unread = notifs.filter(n => !drReadNotifIds.includes(n.id)).length;
  const badge  = document.getElementById('notifBadge');
  badge.textContent   = unread;
  badge.style.display = unread > 0 ? 'flex' : 'none';
  const listEl = document.getElementById('notifList');
  if (!notifs.length) {
    listEl.innerHTML = '<p class="notif-empty"><i class="fas fa-bell-slash"></i><br>No notifications yet</p>';
    return;
  }
  listEl.innerHTML = notifs.map(n => `
    <div class="notif-item ${drReadNotifIds.includes(n.id) ? 'read' : 'unread'}" onclick="navigateFromNotif('${n.section}','${n.id}')">
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
  if (!drReadNotifIds.includes(notifId)) {
    drReadNotifIds.push(notifId);
    localStorage.setItem('doctorReadNotifs', JSON.stringify(drReadNotifIds));
  }
  document.getElementById('notifPanel').classList.remove('open');
  buildDoctorNotifications();
  document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`${section}Section`).style.display = 'block';
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(`'${section}'`)) {
      item.classList.add('active');
    }
  });
  if (section === 'messages') {
    populateMsgDropdown();
  } else if (section === 'appointments') {
    // Derive filter from notifId prefix
    const filter = notifId.startsWith('apt-pending') ? 'pending'
                 : notifId.startsWith('apt-confirmed') ? 'confirmed'
                 : 'all';
    filterByStatus(filter);
  }
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
    ['pending','confirmed','cancelled'].forEach(s => {
      const id = `apt-${s}-${a._id}`;
      if (!drReadNotifIds.includes(id)) drReadNotifIds.push(id);
    });
  });
  localStorage.setItem('doctorReadNotifs', JSON.stringify(drReadNotifIds));
  buildDoctorNotifications();
}

// ─── MESSAGING ───────────────────────────────────────────────
let selectedMsgType = 'medical_advice';

function populateMsgDropdown() {
  const select = document.getElementById('msgAppointmentSelect');
  const confirmed = appointments.filter(a => a.status === 'confirmed');
  select.innerHTML = '<option value="">-- Select Patient --</option>';
  confirmed.forEach(apt => {
    const name = apt.patientId
      ? (apt.patientId.name || `${apt.patientId.firstName || ''} ${apt.patientId.lastName || ''}`.trim() || 'Patient')
      : 'Patient';
    select.innerHTML += `<option value="${apt._id}">${name} — ${new Date(apt.appointmentDate).toLocaleDateString()} ${apt.timeSlot}</option>`;
  });
  select.onchange = () => loadMsgHistory(select.value);
}

function selectMsgType(btn) {
  document.querySelectorAll('.msg-type').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedMsgType = btn.dataset.type;
}

async function sendMessage() {
  const appointmentId = document.getElementById('msgAppointmentSelect').value;
  const message = document.getElementById('msgText').value.trim();
  const statusEl = document.getElementById('msgStatus');

  if (!appointmentId) {
    statusEl.textContent = 'Please select a patient.';
    statusEl.style.color = '#e74c3c';
    return;
  }
  if (!message) {
    statusEl.textContent = 'Please write a message.';
    statusEl.style.color = '#e74c3c';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ appointmentId, message, type: selectedMsgType })
    });

    const data = await response.json();
    if (response.ok) {
      statusEl.textContent = '✓ Message sent successfully!';
      statusEl.style.color = '#27ae60';
      document.getElementById('msgText').value = '';
      loadMsgHistory(appointmentId);
      setTimeout(() => statusEl.textContent = '', 3000);
    } else {
      statusEl.textContent = data.error;
      statusEl.style.color = '#e74c3c';
    }
  } catch (error) {
    statusEl.textContent = 'Error sending message.';
    statusEl.style.color = '#e74c3c';
  }
}

async function loadMsgHistory(appointmentId) {
  if (!appointmentId) return;
  const listEl = document.getElementById('msgHistoryList');
  listEl.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const response = await fetch(`${API_URL}/messages/${appointmentId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const messages = await response.json();

    if (!messages.length) {
      listEl.innerHTML = '<p class="no-data">No messages sent yet.</p>';
      return;
    }

    const typeIcons = {
      medical_advice: 'fa-stethoscope',
      instructions: 'fa-list-check',
      medicine: 'fa-pills',
      general: 'fa-comment'
    };
    const typeLabels = {
      medical_advice: 'Medical Advice',
      instructions: 'Instructions',
      medicine: 'Medicine',
      general: 'General'
    };

    listEl.innerHTML = messages.map(msg => `
      <div class="msg-card msg-${msg.type}">
        <div class="msg-card-header">
          <span class="msg-tag"><i class="fas ${typeIcons[msg.type]}"></i> ${typeLabels[msg.type]}</span>
          <span class="msg-time">${new Date(msg.createdAt).toLocaleString()}</span>
        </div>
        <p class="msg-body">${msg.message}</p>
      </div>
    `).join('');
  } catch (error) {
    listEl.innerHTML = '<p class="error">Error loading messages.</p>';
  }
}
