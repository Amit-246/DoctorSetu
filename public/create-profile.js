const API   = 'http://localhost:3000/api/patient/auth';
const token = localStorage.getItem('patientToken');

if (!token) {
  window.location.href = 'login.html';
}

// If profile already created, go straight to dashboard
(async () => {
  try {
    const res      = await fetch(`${API}/profiles`, { headers: { 'Authorization': `Bearer ${token}` } });
    const profiles = await res.json();
    if (res.ok && profiles.length > 0) {
      window.location.replace('patient-dashboard.html');
    }
  } catch {}
})();

// Prevent browser back from landing on this page after profile is created
history.pushState(null, '', window.location.href);
window.addEventListener('popstate', () => {
  const hasProfile = localStorage.getItem('patientProfile');
  if (hasProfile) {
    window.location.replace('patient-dashboard.html');
  } else {
    history.pushState(null, '', window.location.href);
  }
});

function goBack() {
  // Clear session and return to login so user can re-enter with a different number
  localStorage.removeItem('patientToken');
  localStorage.removeItem('patientMobile');
  localStorage.removeItem('patientProfile');
  window.location.href = 'login.html';
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name   = document.getElementById('name').value.trim();
  const age    = document.getElementById('age').value;
  const gender = document.querySelector('input[name="gender"]:checked')?.value;
  const email  = document.getElementById('email').value.trim();
  const errEl  = document.getElementById('errMsg');

  if (!name)   { errEl.textContent = 'Please enter your name.';    return; }
  if (!age)    { errEl.textContent = 'Please enter your age.';     return; }
  if (!gender) { errEl.textContent = 'Please select your gender.'; return; }
  errEl.textContent = '';

  try {
    const res  = await fetch(`${API}/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name, age, gender, email })
    });

    const data = await res.json();

    if (res.ok) {
      const selRes  = await fetch(`${API}/select-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ patientId: data.patient._id })
      });

      const selData = await selRes.json();

      if (selRes.ok) {
        localStorage.setItem('patientToken',   selData.token);
        localStorage.setItem('patientProfile', JSON.stringify(selData.patient));
        localStorage.setItem('patientMobile',  selData.patient.mobile);
        window.location.replace('patient-dashboard.html');
      }
    } else {
      errEl.textContent = data.error || 'Failed to create profile.';
    }
  } catch {
    errEl.textContent = 'Server error. Please try again.';
  }
});
