const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const path      = require('path');
const Nurse     = require('../models/Nurse');
const MobileAccount = require('../models/MobileAccount');
const nurseAuth = require('../middleware/nurseAuth');

const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => cb(null, 'nurse-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.get('/profile', nurseAuth, async (req, res) => {
  try {
    const nurse = await Nurse.findById(req.nurseId).select('-otp -otpExpiry');
    res.json(nurse);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/profile', nurseAuth, upload.single('profilePhoto'), async (req, res) => {
  try {
    const { name, age, gender, qualification, availabilityStart, availabilityEnd,
            permanentAddress, presentAddress } = req.body;

    const update = { name, age, gender, qualification, availabilityStart, availabilityEnd,
                     permanentAddress, presentAddress, isProfileComplete: true };
    if (req.file) update.profilePhoto = '/uploads/' + req.file.filename;

    const nurse = await Nurse.findByIdAndUpdate(req.nurseId, update, { new: true });
    // Mark profile complete on MobileAccount (locks role permanently)
    await MobileAccount.findOneAndUpdate({ mobile: nurse.mobile }, { profileCompleted: true, role: 'nurse' });
    res.json({ message: 'Profile updated', nurse });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
