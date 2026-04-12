const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const Nurse   = require('../models/Nurse');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile || !/^[0-9]{10}$/.test(mobile))
      return res.status(400).json({ error: 'Valid 10-digit mobile number required' });

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60000);

    let nurse = await Nurse.findOne({ mobile });
    if (nurse) { nurse.otp = otp; nurse.otpExpiry = otpExpiry; await nurse.save(); }
    else        { nurse = await Nurse.create({ mobile, otp, otpExpiry }); }

    console.log(`[NURSE OTP] ${mobile}: ${otp}`);
    res.json({ message: 'OTP sent successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    const nurse = await Nurse.findOne({ mobile });
    if (!nurse || nurse.otp !== otp || nurse.otpExpiry < new Date())
      return res.status(400).json({ error: 'Invalid or expired OTP' });

    nurse.otp = undefined; nurse.otpExpiry = undefined;
    await nurse.save();

    const token = jwt.sign({ id: nurse._id, mobile }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful', token, isProfileComplete: nurse.isProfileComplete });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
