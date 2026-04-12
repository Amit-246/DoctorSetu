require('dotenv').config();
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

const doctorAuthRoutes  = require('./routes/doctorAuth');
const doctorProfileRoutes = require('./routes/doctorProfile');
const appointmentRoutes = require('./routes/appointments');
const messageRoutes     = require('./routes/messages');
const patientAuthRoutes = require('./routes/patientAuth');
const patientRoutes     = require('./routes/patientRoutes');
const bookingRoutes     = require('./routes/bookingRoutes');
const chatRoutes        = require('./routes/chatRoutes');
const nurseAuthRoutes   = require('./routes/nurseAuth');
const nurseProfileRoutes= require('./routes/nurseProfile');
const nurseAptRoutes    = require('./routes/nurseAppointments');
const unifiedAuthRoutes = require('./routes/unifiedAuth');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

if (!fs.existsSync('./public/uploads')) fs.mkdirSync('./public/uploads', { recursive: true });
if (!fs.existsSync('./public/uploads/reports')) fs.mkdirSync('./public/uploads/reports', { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.get('/', (req, res) => res.redirect('/login.html'));

app.use('/api/doctor/auth', doctorAuthRoutes);
app.use('/api/doctor', doctorProfileRoutes);
app.use('/api/doctor', appointmentRoutes);
app.use('/api/doctor', messageRoutes);
app.use('/api/doctor', chatRoutes);
app.use('/api/patient/auth', patientAuthRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/patient', bookingRoutes);
app.use('/api/patient', chatRoutes);
app.use('/api/nurse/auth', nurseAuthRoutes);
app.use('/api/nurse', nurseProfileRoutes);
app.use('/api/nurse', nurseAptRoutes);
app.use('/api/auth', unifiedAuthRoutes);

// ── SOCKET.IO — WebRTC signaling + real-time chat ──────────
// Rooms keyed by appointmentId
io.on('connection', socket => {
  socket.on('join-room', ({ appointmentId, role, name }) => {
    socket.join(appointmentId);
    socket.data = { appointmentId, role, name };
    socket.to(appointmentId).emit('peer-joined', { role, name });
  });

  // WebRTC signaling
  socket.on('offer',     data => socket.to(data.appointmentId).emit('offer',     data));
  socket.on('answer',    data => socket.to(data.appointmentId).emit('answer',    data));
  socket.on('ice-candidate', data => socket.to(data.appointmentId).emit('ice-candidate', data));

  // Real-time chat relay
  socket.on('chat-message', data => {
    io.to(data.appointmentId).emit('chat-message', data);
  });

  // Call ended signal
  socket.on('call-ended', data => {
    socket.to(data.appointmentId).emit('call-ended', data);
  });

  socket.on('disconnect', () => {
    if (socket.data?.appointmentId) {
      socket.to(socket.data.appointmentId).emit('peer-left', { role: socket.data.role });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
