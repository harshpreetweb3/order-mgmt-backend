const User = require('../models/User');

// @desc    Create new user
// @route   POST /api/users
// @access  Private (Admin, Distributor)
const createUser = async (req, res) => {
  const { name, email, password, role, distributorId, superStockistId } = req.body;

  // Validation
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password, and role are required' });
  }

  // Authorization check for non-admin
  if (req.user.role === 'Distributor' && role !== 'Salesman') {
    return res.status(403).json({ message: 'Distributors can only create Salesman accounts' });
  }

  const userExists = await User.findOne({ email });

  if (userExists) {
    return res.status(400).json({ message: 'User with this email already exists' });
  }

  let finalDistributorId = distributorId;
  let finalSuperStockistId = superStockistId;

  // If created by Distributor, automatically attach distributorId
  if (req.user.role === 'Distributor') {
    finalDistributorId = req.user._id;
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    distributorId: finalDistributorId || null,
    superStockistId: finalSuperStockistId || null,
    status: 'Active',
  });

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    distributorId: user.distributorId,
    superStockistId: user.superStockistId,
  });
};

// @desc    Get users list
// @route   GET /api/users
// @access  Private
const getUsers = async (req, res) => {
  const { role, status, superStockistId } = req.query;
  const filter = {};

  if (role) filter.role = role;
  if (status) filter.status = status;
  if (superStockistId) filter.superStockistId = superStockistId;

  // Scope listing based on current user role
  if (req.user.role === 'Distributor') {
    // Distributor sees their assigned salesmen
    filter.role = 'Salesman';
    filter.distributorId = req.user._id;
  } else if (req.user.role === 'Super Stockist') {
    // Super Stockist sees Distributors assigned to them
    filter.role = 'Distributor';
    filter.superStockistId = req.user._id;
  } else if (req.user.role === 'Salesman') {
    // Salesman sees Distributors (to select Order To)
    filter.role = 'Distributor';
  }

  const users = await User.find(filter)
    .populate('distributorId', 'name email')
    .populate('superStockistId', 'name email')
    .select('-password')
    .sort({ createdAt: -1 });

  res.json(users);
};

// @desc    Update user status (Active / Inactive) or details
// @route   PUT /api/users/:id
// @access  Private (Admin)
const updateUser = async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const { name, email, role, status, distributorId, superStockistId, password } = req.body;

  if (name) user.name = name;
  if (email) user.email = email;
  if (role) user.role = role;
  if (status) user.status = status;
  if (distributorId !== undefined) user.distributorId = distributorId;
  if (superStockistId !== undefined) user.superStockistId = superStockistId;
  if (password) user.password = password; // pre('save') will hash if modified

  const updatedUser = await user.save();

  res.json({
    _id: updatedUser._id,
    name: updatedUser.name,
    email: updatedUser.email,
    role: updatedUser.role,
    status: updatedUser.status,
    distributorId: updatedUser.distributorId,
    superStockistId: updatedUser.superStockistId,
  });
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin)
const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  await User.deleteOne({ _id: user._id });
  res.json({ message: 'User removed successfully' });
};

module.exports = {
  createUser,
  getUsers,
  updateUser,
  deleteUser,
};
