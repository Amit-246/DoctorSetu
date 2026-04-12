const API = 'http://localhost:3000/api';
let currentMobile = '';
let mobileToken   = '';

// ── NAVIGATION ────────────────────────────────────────────
function showStep(stepId) {
  ['mobileStep', 'otpStep', 'roleStep'].forEach(id =>
    document.getElementById(id).style.display = 'none');
  document.getElementById(stepId).style.display = 'block';
  clearMessage();
}

// ── SEND OTP ──────────────────────────────────────────────
async function sendOTP() {
  const mobile = document.getElementById('mobile').value.trim();
  if (!/^[0-9]{10}$/.test(mobile)) {
    showMessage('Please enter a valid 10-digit mobile number.', true); return;
  }
  try {
    const res  = await fetch(`${API}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile })
    });
    const data = await res.json();
    if (res.ok) {
      currentMobile = mobile;
      document.getElementById('mobileDisplay').textContent = mobile;
      document.querySelectorAll('.otp-input').forEach(i => i.value = '');
      showStep('otpStep');
      showMessage('OTP sent! Check server console.', false);
    } else {
      showMessage(data.error || 'Failed to send OTP.', true);
    }
  } catch { showMessage('Server error. Please try again.', true); }
}

// ── OTP BOX NAVIGATION ────────────────────────────────────
function otpMove(input, index) {
  input.value = input.value.replace(/[^0-9]/g, '');
  if (input.value && index < 6) document.querySelectorAll('.otp-input')[index].focus();
}

function getOTPValue() {
  return Array.from(document.querySelectorAll('.otp-input')).map(i => i.value).join('');
}

// ── VERIFY OTP ────────────────────────────────────────────
async function verifyOTP() {
  const otp = getOTPValue();
  if (otp.length !== 6) { showMessage('Please enter the complete 6-digit OTP.', true); return; }

  try {
    const res  = await fetch(`${API}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: currentMobile, otp })
    });
    const data = await res.json();
    if (!res.ok) { showMessage(data.error || 'Invalid OTP.', true); return; }

    mobileToken = data.token;

    // If mobile already has a locked role → skip role selection entirely
    if (data.lockedRole) {
      const msg = data.profileCompleted ? `Welcome back! Redirecting...` : `Continuing profile setup...`;
      showMessage(msg, false);
      await autoLoginLockedRole(data.lockedRole, data.profileCompleted);
      return;
    }

    showMessage('OTP verified! Select your role.', false);
    showStep('roleStep');
  } catch { showMessage('Server error. Please try again.', true); }
}

// ── AUTO LOGIN FOR LOCKED ROLE ────────────────────────────
async function autoLoginLockedRole(role, profileCompleted) {
  if (role === 'patient') {
    if (!profileCompleted) {
      // Role locked but no profile yet — go straight to profile creation
      localStorage.setItem('patientToken',  mobileToken);
      localStorage.setItem('patientMobile', currentMobile);
      window.location.href = 'patient-create-profile.html';
      return;
    }
    await loginAsPatient();
    return;
  }
  try {
    const res  = await fetch(`${API}/auth/select-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mobileToken}` },
      body: JSON.stringify({ role })
    });
    const data = await res.json();
    if (res.ok) {
      if (role === 'doctor') {
        localStorage.setItem('doctorToken', data.token);
        window.location.href = data.isProfileComplete ? 'doctor-dashboard.html' : 'doctor-profile.html';
      } else {
        localStorage.setItem('nurseToken', data.token);
        window.location.href = data.isProfileComplete ? 'nurse-dashboard.html' : 'nurse-profile.html';
      }
    } else {
      showMessage(data.error || 'Login failed.', true);
      showStep('roleStep');
    }
  } catch { showMessage('Server error.', true); }
}

// ── ROLE SELECTION (new users only) ──────────────────────
async function selectRole(role) {
  showMessage('Logging in...', false);

  if (role === 'patient') {
    // Lock patient role on MobileAccount before proceeding
    await fetch(`${API}/auth/select-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mobileToken}` },
      body: JSON.stringify({ role: 'patient' })
    });
    await loginAsPatient();
    return;
  }

  try {
    const res  = await fetch(`${API}/auth/select-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mobileToken}` },
      body: JSON.stringify({ role })
    });
    const data = await res.json();
    if (res.ok) {
      if (role === 'doctor') {
        localStorage.setItem('doctorToken', data.token);
        window.location.href = data.isProfileComplete ? 'doctor-dashboard.html' : 'doctor-profile.html';
      } else {
        localStorage.setItem('nurseToken', data.token);
        window.location.href = data.isProfileComplete ? 'nurse-dashboard.html' : 'nurse-profile.html';
      }
    } else {
      // Role conflict — show error and highlight the locked role
      showMessage(data.error || 'Login failed.', true);
      if (data.lockedRole) highlightLockedRole(data.lockedRole);
    }
  } catch { showMessage('Server error.', true); }
}

function highlightLockedRole(role) {
  document.querySelectorAll('.role-card').forEach(c => {
    c.style.opacity = '0.4';
    c.style.pointerEvents = 'none';
  });
  const map = { patient: 0, doctor: 1, nurse: 2 };
  const cards = document.querySelectorAll('.role-card');
  if (cards[map[role]]) {
    cards[map[role]].style.opacity = '1';
    cards[map[role]].style.pointerEvents = 'auto';
    cards[map[role]].style.borderColor = '#27ae60';
    cards[map[role]].style.boxShadow = '0 6px 25px rgba(39,174,96,0.3)';
  }
}

// ── PATIENT LOGIN ─────────────────────────────────────────
async function loginAsPatient() {
  localStorage.setItem('patientToken',  mobileToken);
  localStorage.setItem('patientMobile', currentMobile);

  try {
    const profRes = await fetch(`${API}/patient/auth/profiles`, {
      headers: { 'Authorization': `Bearer ${mobileToken}` }
    });
    const profiles = await profRes.json();

    if (!Array.isArray(profiles) || !profiles.length) {
      window.location.href = 'patient-create-profile.html'; return;
    }
    const selRes  = await fetch(`${API}/patient/auth/select-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mobileToken}` },
      body: JSON.stringify({ patientId: profiles[0]._id })
    });
    const selData = await selRes.json();
    if (selRes.ok) {
      localStorage.setItem('patientToken',   selData.token);
      localStorage.setItem('patientProfile', JSON.stringify(selData.patient));
    }
    window.location.href = 'patient-dashboard.html';
  } catch { window.location.href = 'patient-dashboard.html'; }
}

// ── HELPERS ───────────────────────────────────────────────
function showMessage(msg, isError) {
  const el = document.getElementById('message');
  el.textContent = msg;
  el.style.color = isError ? '#e74c3c' : '#27ae60';
}
function clearMessage() { document.getElementById('message').textContent = ''; }

document.getElementById('mobile').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); sendOTP(); }
});
document.querySelectorAll('.otp-input').forEach(input => {
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); verifyOTP(); } });
});

// Redirect if already logged in
if (localStorage.getItem('doctorToken'))
  window.location.href = 'doctor-dashboard.html';
else if (localStorage.getItem('nurseToken'))
  window.location.href = 'nurse-dashboard.html';
else if (localStorage.getItem('patientToken') && localStorage.getItem('patientProfile'))
  window.location.href = 'patient-dashboard.html';
