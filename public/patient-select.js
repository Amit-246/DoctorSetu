const API = 'http://localhost:3000/api/patient/auth';
const token = localStorage.getItem('patientToken');

if (!token) {
  window.location.href = 'login.html';
}

const relationIcons = {
  Self: 'fa-user',
  Parent: 'fa-person-cane',
  Child: 'fa-child',
  Spouse: 'fa-heart',
  Sibling: 'fa-people-group',
  Other: 'fa-user-tag'
};

// ── LOAD PROFILES ─────────────────────────────────────────
async function loadProfiles() {
  try {
    const res = await fetch(`${API}/profiles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const profiles = await res.json();
    renderProfiles(profiles);
  } catch {
    document.getElementById('profilesGrid').innerHTML =
      '<p class="loading-card">Error loading profiles.</p>';
  }
}

function renderProfiles(profiles) {
  const grid = document.getElementById('profilesGrid');

  const cards = profiles.map(p => {
    const rel = (p.relation || 'other').toLowerCase();
    const icon = relationIcons[p.relation] || 'fa-user';
    return `
      <div class="profile-card" onclick="selectProfile('${p._id}')">
        <div class="avatar ${rel}">
          <i class="fas ${icon}"></i>
        </div>
        <h3>${p.name || p.firstName}</h3>
        <span class="relation-tag">${p.relation || 'Self'}</span>
        <p class="meta">${p.gender} &bull; ${p.age} yrs${p.bloodGroup ? ' &bull; ' + p.bloodGroup : ''}</p>
      </div>
    `;
  }).join('');

  const addCard = `
    <div class="add-card" onclick="openModal()">
      <div class="add-icon"><i class="fas fa-plus"></i></div>
      <h3>Add Member</h3>
      <p>Add a family member</p>
    </div>
  `;

  grid.innerHTML = cards + addCard;
}

// ── SELECT PROFILE ────────────────────────────────────────
async function selectProfile(patientId) {
  try {
    const res = await fetch(`${API}/select-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ patientId })
    });

    const data = await res.json();

    if (res.ok) {
      // Store the full token (with patientId) and profile info
      localStorage.setItem('patientToken', data.token);
      localStorage.setItem('patientProfile', JSON.stringify(data.patient));
      window.location.href = 'patient-dashboard.html';
    } else {
      alert(data.error);
    }
  } catch {
    alert('Error selecting profile.');
  }
}

// ── ADD NEW MEMBER ────────────────────────────────────────
function openModal() {
  document.getElementById('addModal').classList.add('open');
}

function closeModal() {
  document.getElementById('addModal').classList.remove('open');
  document.getElementById('addForm').reset();
  document.getElementById('formMsg').textContent = '';
}

document.getElementById('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const body = Object.fromEntries(formData.entries());
  const msgEl = document.getElementById('formMsg');

  try {
    const res = await fetch(`${API}/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (res.ok) {
      msgEl.style.color = '#27ae60';
      msgEl.textContent = '✓ Member added successfully!';
      setTimeout(() => {
        closeModal();
        loadProfiles();
      }, 1000);
    } else {
      msgEl.style.color = '#e74c3c';
      msgEl.textContent = data.error;
    }
  } catch {
    msgEl.style.color = '#e74c3c';
    msgEl.textContent = 'Error adding member.';
  }
});

// Close modal on backdrop click
document.getElementById('addModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('addModal')) closeModal();
});

function logout() {
  localStorage.removeItem('patientToken');
  localStorage.removeItem('patientMobile');
  localStorage.removeItem('patientProfile');
  window.location.href = 'login.html';
}

loadProfiles();
