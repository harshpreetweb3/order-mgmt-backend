const User = require('../models/User');
const Order = require('../models/Order');

// Helper to populate all order user references
const populateOrderFields = (query) => {
  return query
    .populate('createdBy', 'name email role')
    .populate('orderTo', 'name email role')
    .populate('salesman', 'name email')
    .populate('distributor', 'name email')
    .populate('superStockist', 'name email')
    .populate('cancelledBy', 'name email role');
};

// @desc    Get dashboard metrics & counters scoped by role
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
  const role = req.user.role;
  const userId = req.user._id;

  if (role === 'Salesman') {
    const totalOrders = await Order.countDocuments({ createdBy: userId });
    const pendingOrders = await Order.countDocuments({ createdBy: userId, status: 'Pending' });
    const deliveredOrders = await Order.countDocuments({ createdBy: userId, status: 'Delivered' });
    const cancelledOrders = await Order.countDocuments({ createdBy: userId, status: 'Cancelled' });

    const recentOrders = await populateOrderFields(
      Order.find({ createdBy: userId }).sort({ createdAt: -1 }).limit(5)
    );

    return res.json({
      role,
      totalOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      recentOrders,
    });
  }

  if (role === 'Distributor') {
    // Orders received from Salesmen
    const ordersReceivedCount = await Order.countDocuments({ orderTo: userId });
    // Orders created by Distributor sent to Super Stockist
    const ordersSentCount = await Order.countDocuments({ createdBy: userId });

    const pendingCount = await Order.countDocuments({
      $or: [{ orderTo: userId }, { createdBy: userId }],
      status: 'Pending',
    });

    const deliveredCount = await Order.countDocuments({
      $or: [{ orderTo: userId }, { createdBy: userId }],
      status: 'Delivered',
    });

    const cancelledCount = await Order.countDocuments({
      $or: [{ orderTo: userId }, { createdBy: userId }],
      status: 'Cancelled',
    });

    const salesmenCount = await User.countDocuments({ role: 'Salesman', distributorId: userId });

    const recentReceivedOrders = await populateOrderFields(
      Order.find({ orderTo: userId }).sort({ createdAt: -1 }).limit(5)
    );

    const recentSentOrders = await populateOrderFields(
      Order.find({ createdBy: userId }).sort({ createdAt: -1 }).limit(5)
    );

    return res.json({
      role,
      ordersReceivedCount,
      ordersSentCount,
      pendingCount,
      deliveredCount,
      cancelledCount,
      salesmenCount,
      recentReceivedOrders,
      recentSentOrders,
    });
  }

  if (role === 'Super Stockist') {
    const ordersReceivedCount = await Order.countDocuments({ orderTo: userId });
    const pendingCount = await Order.countDocuments({ orderTo: userId, status: 'Pending' });
    const deliveredCount = await Order.countDocuments({ orderTo: userId, status: 'Delivered' });
    const cancelledCount = await Order.countDocuments({ orderTo: userId, status: 'Cancelled' });

    const recentOrders = await populateOrderFields(
      Order.find({ orderTo: userId }).sort({ createdAt: -1 }).limit(5)
    );

    return res.json({
      role,
      ordersReceivedCount,
      pendingCount,
      deliveredCount,
      cancelledCount,
      recentOrders,
    });
  }

  if (role === 'Admin') {
    const totalSalesmen = await User.countDocuments({ role: 'Salesman' });
    const totalDistributors = await User.countDocuments({ role: 'Distributor' });
    const totalSuperStockists = await User.countDocuments({ role: 'Super Stockist' });
    
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'Pending' });
    const deliveredOrders = await Order.countDocuments({ status: 'Delivered' });
    const cancelledOrders = await Order.countDocuments({ status: 'Cancelled' });

    const recentOrders = await populateOrderFields(
      Order.find().sort({ createdAt: -1 }).limit(6)
    );

    const recentUsers = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(5);

    return res.json({
      role,
      totalSalesmen,
      totalDistributors,
      totalSuperStockists,
      totalOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      recentOrders,
      recentUsers,
    });
  }

  res.status(400).json({ message: 'Invalid user role' });
};

module.exports = {
  getDashboardStats,
};
