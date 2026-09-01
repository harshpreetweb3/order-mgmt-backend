const User = require('../models/User');

// @desc    Create new user
// @route   POST /api/users
// @access  Private (Admin)
const createUser = async (req, res) => {
  const { name, email, password, role, distributorId, superStockistId, assignedBrands } = req.body;

  // Authorization check - only Admin can create users
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Only Admin can create user accounts' });
  }

  // Validation
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password, and role are required' });
  }

  const userExists = await User.findOne({ email });

  if (userExists) {
    return res.status(400).json({ message: 'User with this email already exists' });
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    distributorId: distributorId || null,
    superStockistId: superStockistId || null,
    assignedBrands: Array.isArray(assignedBrands) ? assignedBrands : [],
    status: 'Active',
  });

  const fullUser = await User.findById(user._id)
    .populate('distributorId', 'name email')
    .populate('superStockistId', 'name email')
    .populate('assignedBrands', 'name')
    .select('-password');

  res.status(201).json(fullUser);
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
    if (role === 'Super Stockist' || role === 'Admin') {
      filter.role = role;
    } else {
      // Default: Distributor sees only their assigned Salesmen
      filter.role = 'Salesman';
      filter.distributorId = req.user._id;
    }
  } else if (req.user.role === 'Super Stockist') {
    if (role === 'Admin') {
      filter.role = 'Admin';
    } else {
      // Default: Super Stockist sees Distributors assigned to them
      filter.role = 'Distributor';
      filter.superStockistId = req.user._id;
    }
  } else if (req.user.role === 'Salesman') {
    // Salesman sees Distributors (to select Order To)
    filter.role = 'Distributor';
  } else if (req.user.role === 'ASM') {
    if (role === 'Super Stockist' || role === 'Admin') {
      filter.role = role;
    } else if (req.user.distributorId) {
      filter.distributorId = req.user.distributorId;
    }
  } else if (req.user.role === 'ASE') {
    if (role === 'Admin' || role === 'Super Stockist') {
      filter.role = role;
    } else if (req.user.superStockistId) {
      filter.superStockistId = req.user.superStockistId;
    }
  }

  const users = await User.find(filter)
    .populate('distributorId', 'name email')
    .populate('superStockistId', 'name email')
    .populate('assignedBrands', 'name')
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

  const { name, email, role, status, distributorId, superStockistId, assignedBrands, password } = req.body;

  if (name) user.name = name;
  if (email) user.email = email;
  if (role) user.role = role;
  if (status) user.status = status;
  if (distributorId !== undefined) user.distributorId = distributorId;
  if (superStockistId !== undefined) user.superStockistId = superStockistId;
  if (assignedBrands !== undefined) user.assignedBrands = Array.isArray(assignedBrands) ? assignedBrands : [];
  if (password) user.password = password; // pre('save') will hash if modified

  await user.save();

  const updatedUser = await User.findById(user._id)
    .populate('distributorId', 'name email')
    .populate('superStockistId', 'name email')
    .populate('assignedBrands', 'name')
    .select('-password');

  res.json(updatedUser);
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
