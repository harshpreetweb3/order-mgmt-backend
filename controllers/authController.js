const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'super_secret_jwt_key_order_management_2026',
    {
      expiresIn: process.env.JWT_EXPIRE || '30d',
    }
  );
};

// @desc    Auth user & get token (supports Email, Username, or Phone Number)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, username, identifier, password } = req.body;
  const loginInput = (identifier || username || email || '').trim();

  if (!loginInput || !password) {
    return res.status(400).json({ message: 'Please provide username, email, or phone number and password' });
  }

  const loginLower = loginInput.toLowerCase();
  const digitsOnly = loginInput.replace(/\D/g, '');

  const searchConditions = [
    { email: loginLower },
    { username: loginLower },
  ];

  // If user entered a phone number or string with digits
  if (digitsOnly && digitsOnly.length >= 7) {
    searchConditions.push({ username: digitsOnly });
    searchConditions.push({ phone: digitsOnly });
    searchConditions.push({ phone: loginInput });
    if (digitsOnly.length === 10) {
      searchConditions.push({ username: `+91${digitsOnly}` });
      searchConditions.push({ phone: `+91${digitsOnly}` });
    }
  }

  const user = await User.findOne({ $or: searchConditions }).select('+password');

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (user.status === 'Inactive') {
    return res.status(403).json({ message: 'Your account is inactive. Please contact Admin.' });
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Populate references if applicable
  await user.populate('distributorId', 'name email username phone');
  await user.populate('superStockistId', 'name email username phone');

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    username: user.username || '',
    phone: user.phone || '',
    role: user.role,
    status: user.status,
    distributorId: user.distributorId,
    superStockistId: user.superStockistId,
    token: generateToken(user._id),
  });
};

// @desc    Get logged in user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('distributorId', 'name email username phone')
    .populate('superStockistId', 'name email username phone');

  res.json(user);
};

module.exports = {
  loginUser,
  getMe,
};
