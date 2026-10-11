# 🏥 DoctorSetu — Smart Healthcare Appointment Platform

> A full-stack healthcare platform connecting **Patients**, **Doctors**, and **Nurses** for seamless appointment booking, online consultations, home visits, and clinic management.

---

## 📋 Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Database](#database)
- [Future Enhancements](#future-enhancements)

---

## About

**DoctorSetu** is a role-based healthcare management platform designed to simplify the way patients connect with doctors and nurses. It supports three consultation modes:

- 🖥️ **Online Consultation** — Video/chat-based appointments
- 🏠 **Home Visit** — Doctor or nurse visits at the patient's location
- 🏥 **Clinic Visit** — In-person appointments at the doctor's clinic

Each user role — Patient, Doctor, and Nurse — has a dedicated dashboard with tailored features.

---

## Features

### 👤 Patient Dashboard
- **Multi-profile management** — Manage health records for the entire family under one account
- **Appointment booking** — Book Online, Home Visit (Doctor/Nurse), or Clinic appointments via a guided 4-step wizard
- **Smart doctor suggestion** — AI-based doctor recommendations based on described symptoms
- **Clinic view** — Browse and select clinics directly from the booking flow
- **Prescription storage** — Store and access medical reports and prescriptions
- **Medical chat** — View messages and advice from doctors
- **Notifications** — Real-time alerts for appointment status changes
- **Profile editing** — Update name, age, gender, relation, and other details

### 🩺 Doctor Dashboard
- **Appointment management** — View Pending, Confirmed, and Total appointments
- **Availability settings** — Set daily availability (max 8 hours per day)
- **Per-type availability** — Configure separate time slots for Online, Home Visit, and Clinic
- **Specializations** — Add up to 5 medical specializations
- **Clinic details** — Add clinic name, address, and photo
- **Profile management** — Complete and edit professional profile
- **Patient details** — View patient health problems and medical reports
- **30-second lock rule** — Confirmed appointments lock after 30 seconds

### 👩‍⚕️ Nurse Dashboard
- **Appointment management** — View and manage assigned nurse visit requests
- **Confirm / Cancel** — Accept or cancel appointments with a 30-second cancellation window
- **Profile management** — Set availability, speciality, experience, and gender preference

### ⚡ Smart Features
- **AI symptom-to-doctor matching** — Maps health keywords to relevant specializations and ranks doctors accordingly
- **Time-based nurse filtering** — Filters nurses by availability range; falls back to all available nurses if no exact match
- **Appointment type filtering** — Doctor list dynamically filters based on selected appointment type (Online / Clinic / Home Visit)
- **Role locking** — A mobile number is permanently locked to one role (Patient / Doctor / Nurse) after registration
- **OTP authentication** — Mobile number + OTP login for all roles
- **JWT-based sessions** — Secure token-based authentication with role-specific tokens

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB, Mongoose |
| **Authentication** | JWT (JSON Web Tokens) |
| **File Uploads** | Multer |
| **Real-time** | Socket.IO (WebRTC signaling + chat) |
| **Icons** | Font Awesome 6 |

---

## Installation

### Prerequisites
- Node.js v16+
- MongoDB (local or Atlas)

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/your-username/DoctorSetu.git
cd DoctorSetu
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure environment variables**
```bash
cp .env.example .env
```
Edit `.env` with your values (see [Environment Variables](#environment-variables)).

**4. Start MongoDB** *(skip if using Atlas)*
```bash
mongod
```

**5. Start the server**
```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

**6. Open in browser**
```
http://localhost:3000
```

---

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/doctorsetu
JWT_SECRET=<your_strong_secret_key>
```

> ⚠️ Never commit your `.env` file. It is already listed in `.gitignore`.

---

## API Overview

### Authentication (Unified)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/send-otp` | Send OTP to mobile number |
| POST | `/api/auth/verify-otp` | Verify OTP and get token |
| POST | `/api/auth/select-role` | Lock role and get role token |
| POST | `/api/auth/profile-complete` | Mark profile as complete |

### Patient
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/patient/auth/profiles` | Get all patient profiles |
| POST | `/api/patient/auth/profiles` | Create patient profile |
| PUT | `/api/patient/auth/profiles/:id` | Update patient profile |
| POST | `/api/patient/auth/select-profile` | Select active profile |
| GET | `/api/patient/appointments` | Get appointments |
| DELETE | `/api/patient/appointments/:id/cancel` | Cancel appointment |
| GET | `/api/patient/prescriptions` | Get prescriptions & reports |
| GET | `/api/patient/messages` | Get doctor messages |
| POST | `/api/patient/book` | Book appointment |
| POST | `/api/patient/book-nurse` | Book nurse visit |
| GET | `/api/patient/doctors` | Get available doctors |
| GET | `/api/patient/nurses` | Get available nurses |

### Doctor
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/doctor/auth/send-otp` | Send OTP |
| POST | `/api/doctor/auth/verify-otp` | Verify OTP |
| GET | `/api/doctor/profile` | Get doctor profile |
| POST | `/api/doctor/profile` | Save/update profile |
| GET | `/api/doctor/appointments` | Get all appointments |
| POST | `/api/doctor/appointments/:id/confirm` | Confirm appointment |
| DELETE | `/api/doctor/appointments/:id/cancel` | Cancel appointment |

### Nurse
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/nurse/auth/send-otp` | Send OTP |
| POST | `/api/nurse/auth/verify-otp` | Verify OTP |
| GET | `/api/nurse/profile` | Get nurse profile |
| POST | `/api/nurse/profile` | Save/update profile |
| GET | `/api/nurse/appointments` | Get assigned appointments |
| POST | `/api/nurse/appointments/:id/confirm` | Confirm appointment |
| DELETE | `/api/nurse/appointments/:id/cancel` | Cancel appointment |

---

## Database

**MongoDB** is used with the following main collections:

| Collection | Description |
|---|---|
| `mobileaccounts` | Stores mobile number → role mapping |
| `patients` | Patient profiles (multiple per mobile) |
| `doctors` | Doctor profiles with availability and clinic info |
| `nurses` | Nurse profiles with availability |
| `appointments` | All appointment records |
| `messages` | Doctor-to-patient messages |
| `prescriptions` | Doctor-issued prescriptions |

---

## Future Enhancements

- 💳 **Payment integration** — Online payment for appointments
- ⭐ **Ratings & reviews** — Patient feedback for doctors and nurses
- 🛠️ **Admin panel** — Platform-wide management dashboard
- 🤖 **AI improvements** — More accurate symptom analysis and doctor matching
- 📱 **Mobile app** — React Native / Flutter client
- 📧 **Email & SMS notifications** — Appointment reminders via Twilio / email

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  Built with ❤️ for better healthcare access
</div>


Working on UI/UX Design for HEAL-2.

working on HEAL-3-backend-development.
