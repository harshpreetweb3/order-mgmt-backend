const Order = require('../models/Order');
const Item = require('../models/Item');
const User = require('../models/User');
const Counter = require('../models/Counter');

// Helper to calculate tier price based on role
const calculateRolePrice = (basePrice, role) => {
  const price = Number(basePrice) || 0;
  if (role === 'Salesman') {
    return Math.round(price * 1.08 * 1.08 * 100) / 100;
  } else if (role === 'Distributor') {
    return Math.round(price * 1.08 * 100) / 100;
  } else {
    return Math.round(price * 100) / 100;
  }
};

// Helper to generate sequential order number
const generateOrderNumber = async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const counterKey = `ORDER_${dateStr}`;
  
  const counter = await Counter.findOneAndUpdate(
    { id: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seqFormatted = String(counter.seq).padStart(4, '0');
  return `ORD-${dateStr}-${seqFormatted}`;
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private (Salesman, Distributor, Super Stockist, Admin)
const createOrder = async (req, res) => {
  const { orderTo, orderFrom, products } = req.body;

  // For Distributors and Super Stockists, orderFrom is auto-set to their own name
  const effectiveOrderFrom =
    (req.user.role === 'Distributor' || req.user.role === 'Super Stockist')
      ? req.user.name
      : orderFrom;

  if (!orderTo || !effectiveOrderFrom || !products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ message: 'Order recipient and at least one item are required' });
  }

  // Verify recipient target user
  const recipientUser = await User.findById(orderTo);
  if (!recipientUser) {
    return res.status(404).json({ message: 'Selected recipient user (Order To) not found' });
  }

  let salesmanId = null;
  let distributorId = null;
  let superStockistId = null;

  if (req.user.role === 'Salesman') {
    salesmanId = req.user._id;
    distributorId = orderTo; // Order To is Distributor
  } else if (req.user.role === 'Distributor') {
    distributorId = req.user._id;
    superStockistId = orderTo; // Order To is Super Stockist
  } else if (req.user.role === 'Super Stockist') {
    superStockistId = req.user._id; // Super Stockist is creator
  } else if (req.user.role === 'Admin') {
    // Admin creating custom order
    if (recipientUser.role === 'Distributor') {
      distributorId = recipientUser._id;
    } else if (recipientUser.role === 'Super Stockist') {
      superStockistId = recipientUser._id;
    }
  }

  // Calculate product line totals using 8% tier pricing factor based on creator role
  const populatedProducts = [];
  let grandTotal = 0;

  for (const itemInput of products) {
    const dbItem = await Item.findById(itemInput.itemId);
    if (!dbItem) {
      return res.status(404).json({ message: `Item with ID ${itemInput.itemId} not found` });
    }

    if (!dbItem.active) {
      return res.status(400).json({ message: `Product '${dbItem.itemName}' is currently inactive` });
    }

    const quantity = Number(itemInput.quantity) || 1;
    const price = calculateRolePrice(dbItem.price, req.user.role);
    const total = Math.round(quantity * price * 100) / 100;
    grandTotal += total;

    populatedProducts.push({
      itemId: dbItem._id,
      itemName: dbItem.itemName,
      quantity,
      price,
      total,
    });
  }

  const orderNumber = await generateOrderNumber();

  const order = await Order.create({
    orderNumber,
    createdBy: req.user._id,
    createdByRole: req.user.role,
    orderTo,
    orderFrom: effectiveOrderFrom,
    salesman: salesmanId,
    distributor: distributorId,
    superStockist: superStockistId,
    products: populatedProducts,
    grandTotal,
    status: 'Pending',
  });

  const fullOrder = await Order.findById(order._id)
    .populate('createdBy', 'name email role')
    .populate('orderTo', 'name email role')
    .populate('salesman', 'name email')
    .populate('distributor', 'name email')
    .populate('superStockist', 'name email');

  res.status(201).json(fullOrder);
};

// @desc    Get orders (Role-scoped with search, filters, sorting)
// @route   GET /api/orders
// @access  Private
const getOrders = async (req, res) => {
  const { search, status, date, distributor, superStockist, scope } = req.query;
  const filter = {};

  // Role Scoping
  if (req.user.role === 'Salesman') {
    filter.createdBy = req.user._id;
  } else if (req.user.role === 'Distributor') {
    if (scope === 'received') {
      // Orders received from Salesmen
      filter.orderTo = req.user._id;
    } else if (scope === 'sent') {
      // Orders created by Distributor sent to Super Stockist
      filter.createdBy = req.user._id;
    } else {
      // All relevant to distributor
      filter.$or = [
        { orderTo: req.user._id },
        { createdBy: req.user._id },
        { distributor: req.user._id }
      ];
    }
  } else if (req.user.role === 'Super Stockist') {
    if (scope === 'received') {
      // Orders received from Distributors
      filter.orderTo = req.user._id;
    } else if (scope === 'sent') {
      // Orders created by Super Stockist sent to Admin
      filter.createdBy = req.user._id;
    } else {
      filter.$or = [
        { orderTo: req.user._id },
        { createdBy: req.user._id },
        { superStockist: req.user._id }
      ];
    }
  }
  // Admin sees all without default filter restriction

  // Apply Status Filter
  if (status && status !== 'All') {
    filter.status = status;
  }

  // Apply Specific Distributor/SuperStockist Filters
  if (distributor) filter.distributor = distributor;
  if (superStockist) filter.superStockist = superStockist;

  // Apply Date Filter
  if (date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: startDate, $lte: endDate };
  }

  let query = Order.find(filter)
    .populate('createdBy', 'name email role')
    .populate('orderTo', 'name email role')
    .populate('salesman', 'name email')
    .populate('distributor', 'name email')
    .populate('superStockist', 'name email')
    .sort({ createdAt: -1 });

  let orders = await query;

  // Search Filter (by Order Number, Shop Name, or Salesman Name)
  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    orders = orders.filter(order => {
      const matchOrderNum = order.orderNumber && searchRegex.test(order.orderNumber);
      const matchShopName = order.orderFrom && searchRegex.test(order.orderFrom);
      const matchSalesman = order.salesman && order.salesman.name && searchRegex.test(order.salesman.name);
      const matchCreator = order.createdBy && order.createdBy.name && searchRegex.test(order.createdBy.name);
      return matchOrderNum || matchShopName || matchSalesman || matchCreator;
    });
  }

  res.json(orders);
};

// @desc    Get single order details
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('createdBy', 'name email role')
    .populate('orderTo', 'name email role')
    .populate('salesman', 'name email')
    .populate('distributor', 'name email')
    .populate('superStockist', 'name email');

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  res.json(order);
};

// @desc    Update order (Salesman edit before delivery)
// @route   PUT /api/orders/:id
// @access  Private (Salesman, Admin)
const updateOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // Check if delivered
  if (order.status === 'Delivered' && req.user.role !== 'Admin') {
    return res.status(400).json({ message: 'Delivered orders are read-only and cannot be modified.' });
  }

  // Check permissions: Salesman can edit only own orders
  if (req.user.role === 'Salesman' && String(order.createdBy) !== String(req.user._id)) {
    return res.status(403).json({ message: 'You can only edit your own orders.' });
  }

  const { orderFrom, products } = req.body;

  if (orderFrom) order.orderFrom = orderFrom;

  if (products && Array.isArray(products) && products.length > 0) {
    const populatedProducts = [];
    let grandTotal = 0;

    for (const itemInput of products) {
      const dbItem = await Item.findById(itemInput.itemId);
      if (!dbItem) {
        return res.status(404).json({ message: `Item with ID ${itemInput.itemId} not found` });
      }

      const quantity = Number(itemInput.quantity) || 1;
      const price = calculateRolePrice(dbItem.price, order.createdByRole || req.user.role);
      const total = Math.round(quantity * price * 100) / 100;
      grandTotal += total;

      populatedProducts.push({
        itemId: dbItem._id,
        itemName: dbItem.itemName,
        quantity,
        price,
        total,
      });
    }

    order.products = populatedProducts;
    order.grandTotal = Math.round(grandTotal * 100) / 100;
  }

  const updatedOrder = await order.save();

  const fullOrder = await Order.findById(updatedOrder._id)
    .populate('createdBy', 'name email role')
    .populate('orderTo', 'name email role')
    .populate('salesman', 'name email')
    .populate('distributor', 'name email')
    .populate('superStockist', 'name email');

  res.json(fullOrder);
};

// @desc    Mark order as Delivered / Toggle status
// @route   PUT /api/orders/:id/delivery
// @access  Private (Distributor, Super Stockist, Admin)
const updateDeliveryStatus = async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const { status, products } = req.body; // 'Delivered' or 'Pending', optional updated products list

  if (req.user.role === 'Salesman') {
    return res.status(403).json({ message: 'Salesman cannot mark orders as delivered' });
  }

  // Non-Admin users can only mark delivered if they are the designated recipient (orderTo)
  if (req.user.role !== 'Admin') {
    const isRecipient = String(order.orderTo) === String(req.user._id);
    if (!isRecipient) {
      return res.status(403).json({ message: 'Only the designated recipient or Admin can update delivery status for this order.' });
    }
  }

  // If order receiver modified product quantities or removed unavailable products before delivery
  if (products && Array.isArray(products)) {
    if (products.length === 0) {
      return res.status(400).json({ message: 'Cannot set order to delivered with 0 products.' });
    }

    const updatedProducts = [];
    let updatedGrandTotal = 0;

    for (const itemInput of products) {
      const existingProd = order.products.find(
        (p) => String(p.itemId) === String(itemInput.itemId)
      );

      const quantity = Math.max(1, Number(itemInput.quantity) || 1);
      // Use existing unit price stored on order or itemMaster calculated rate
      const price = existingProd ? existingProd.price : (Number(itemInput.price) || 0);
      const total = Math.round(quantity * price * 100) / 100;
      updatedGrandTotal += total;

      updatedProducts.push({
        itemId: itemInput.itemId,
        itemName: existingProd ? existingProd.itemName : itemInput.itemName,
        quantity,
        price,
        total,
      });
    }

    order.products = updatedProducts;
    order.grandTotal = Math.round(updatedGrandTotal * 100) / 100;
  }

  const targetStatus = status || (order.status === 'Pending' ? 'Delivered' : 'Pending');

  order.status = targetStatus;
  order.deliveredAt = targetStatus === 'Delivered' ? new Date() : null;

  await order.save();

  const updatedOrder = await Order.findById(order._id)
    .populate('createdBy', 'name email role')
    .populate('orderTo', 'name email role')
    .populate('salesman', 'name email')
    .populate('distributor', 'name email')
    .populate('superStockist', 'name email');

  res.json(updatedOrder);
};

// @desc    Delete order (Salesman prior to delivery or Admin)
// @route   DELETE /api/orders/:id
// @access  Private (Salesman, Admin)
const deleteOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  if (req.user.role === 'Salesman') {
    if (String(order.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only delete your own orders.' });
    }
    if (order.status === 'Delivered') {
      return res.status(400).json({ message: 'Delivered orders cannot be deleted.' });
    }
  }

  await Order.deleteOne({ _id: order._id });
  res.json({ message: 'Order deleted successfully' });
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  updateDeliveryStatus,
  deleteOrder,
};
