const Order = require('../models/Order');
const Item = require('../models/Item');
const User = require('../models/User');
const Shop = require('../models/Shop');
const Counter = require('../models/Counter');

// Helper to calculate tier price based on role
const calculateRolePrice = (basePrice, role) => {
  const price = Number(basePrice) || 0;
  if (role === 'Salesman') {
    return Math.round(price * 1.08 * 1.08 * 100) / 100;
  } else if (role === 'Distributor' || role === 'ASM') {
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
// @access  Private (Salesman, Distributor, Super Stockist, Admin, ASM, ASE)
const createOrder = async (req, res) => {
  const { orderTo, orderFrom, shopId, products } = req.body;

  if (!orderTo) {
    return res.status(400).json({ message: 'Order recipient (orderTo) is required' });
  }

  // Verify recipient target user
  const recipientUser = await User.findById(orderTo);
  if (!recipientUser) {
    return res.status(404).json({ message: 'Selected recipient user (Order To) not found' });
  }

  let salesmanId = null;
  let distributorId = null;
  let superStockistId = null;
  let resolvedEntityName = (orderFrom && orderFrom.trim()) ? orderFrom.trim() : '';

  if (req.user.role === 'Salesman') {
    if (!shopId) {
      return res.status(400).json({ message: 'A registered retail shop is required to create an order as Salesman' });
    }
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Selected retail shop was not found' });
    }
    resolvedEntityName = shop.name;
    salesmanId = req.user._id;
    distributorId = orderTo;
  } else if (req.user.role === 'Distributor') {
    distributorId = req.user._id;
    superStockistId = recipientUser.role === 'Super Stockist' ? orderTo : null;
    if (!resolvedEntityName) resolvedEntityName = req.user.name;
  } else if (req.user.role === 'ASM') {
    distributorId = req.user.distributorId || null;
    superStockistId = recipientUser.role === 'Super Stockist' ? orderTo : null;
    if (distributorId) {
      const distUser = await User.findById(distributorId);
      if (distUser) resolvedEntityName = distUser.name;
    }
    if (!resolvedEntityName) resolvedEntityName = req.user.name;
  } else if (req.user.role === 'ASE') {
    superStockistId = req.user.superStockistId || null;
    if (superStockistId) {
      const ssUser = await User.findById(superStockistId);
      if (ssUser) resolvedEntityName = ssUser.name;
    }
    if (!resolvedEntityName) resolvedEntityName = req.user.name;
  } else if (req.user.role === 'Super Stockist') {
    superStockistId = req.user._id;
    if (!resolvedEntityName) resolvedEntityName = req.user.name;
  } else if (req.user.role === 'Admin') {
    if (recipientUser.role === 'Distributor') {
      distributorId = recipientUser._id;
    } else if (recipientUser.role === 'Super Stockist') {
      superStockistId = recipientUser._id;
    }
    if (!resolvedEntityName) resolvedEntityName = 'KNK Enterprises';
  }

  const effectiveOrderFrom = resolvedEntityName || orderFrom || req.user.name;

  if (!effectiveOrderFrom || !products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ message: 'Order recipient and at least one item are required' });
  }

  // Calculate product line totals using 8% tier pricing factor based on creator role
  const populatedProducts = [];
  let grandTotal = 0;

  for (const itemInput of products) {
    const dbItem = await Item.findById(itemInput.itemId).populate('brandId');
    if (!dbItem) {
      return res.status(404).json({ message: `Item with ID ${itemInput.itemId} not found` });
    }

    if (!dbItem.active) {
      return res.status(400).json({ message: `Product '${dbItem.itemName}' is currently inactive` });
    }

    const quantity = Number(itemInput.quantity) || 1;
    let price = calculateRolePrice(dbItem.price, req.user.role);

    // If salesman role and brand allows salesman price edit, allow custom price
    const brandAllowsPriceEdit = Boolean(dbItem.brandId && dbItem.brandId.allowSalesmanPriceEdit);
    if (req.user.role === 'Salesman' && brandAllowsPriceEdit && itemInput.price !== undefined && itemInput.price !== null && itemInput.price !== '') {
      const customPrice = Number(itemInput.price);
      if (!isNaN(customPrice) && customPrice >= 0) {
        price = Math.round(customPrice * 100) / 100;
      }
    }

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
    shopId: shopId || null,
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
    .populate('superStockist', 'name email')
    .populate('shopId', 'name ownerName phone address');

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
      // Orders created by Distributor sent to Super Stockist or Company
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
  } else if (req.user.role === 'ASM') {
    const asmConds = [{ createdBy: req.user._id }];
    if (req.user.distributorId) {
      asmConds.push({ distributor: req.user.distributorId });
    }
    filter.$or = asmConds;
  } else if (req.user.role === 'ASE') {
    const aseConds = [{ createdBy: req.user._id }];
    if (req.user.superStockistId) {
      aseConds.push({ superStockist: req.user.superStockistId });
    }
    filter.$or = aseConds;
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
    .populate('shopId', 'name ownerName phone address')
    .populate('cancelledBy', 'name email role')
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
    .populate('superStockist', 'name email')
    .populate('shopId', 'name ownerName phone address')
    .populate('cancelledBy', 'name email role');

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

  // Check if delivered or cancelled
  if (order.status === 'Delivered' && req.user.role !== 'Admin') {
    return res.status(400).json({ message: 'Delivered orders are read-only and cannot be modified.' });
  }

  if (order.status === 'Cancelled') {
    return res.status(400).json({ message: 'Cancelled orders are read-only and cannot be modified.' });
  }

  // Check permissions: Non-Admin can edit only their own created orders or orders for their entity
  if (req.user.role !== 'Admin') {
    const isCreator = String(order.createdBy) === String(req.user._id);
    const isASMForDistributor = req.user.role === 'ASM' && String(order.distributor) === String(req.user.distributorId);
    const isASEForSS = req.user.role === 'ASE' && String(order.superStockist) === String(req.user.superStockistId);
    const isDistributorOwner = req.user.role === 'Distributor' && String(order.distributor) === String(req.user._id);
    const isSSOwner = req.user.role === 'Super Stockist' && String(order.superStockist) === String(req.user._id);

    if (!isCreator && !isASMForDistributor && !isASEForSS && !isDistributorOwner && !isSSOwner) {
      return res.status(403).json({ message: 'You can only edit orders created by you or for your entity.' });
    }
  }

  const { orderFrom, shopId, products } = req.body;

  if (shopId) {
    order.shopId = shopId;
    const shop = await Shop.findById(shopId);
    if (shop) order.orderFrom = shop.name;
  } else if (orderFrom) {
    order.orderFrom = orderFrom;
  }

  if (products && Array.isArray(products) && products.length > 0) {
    const populatedProducts = [];
    let grandTotal = 0;

    for (const itemInput of products) {
      const dbItem = await Item.findById(itemInput.itemId).populate('brandId');
      if (!dbItem) {
        return res.status(404).json({ message: `Item with ID ${itemInput.itemId} not found` });
      }

      const quantity = Number(itemInput.quantity) || 1;
      const roleForPricing = order.createdByRole || req.user.role;
      let price = calculateRolePrice(dbItem.price, roleForPricing);

      const brandAllowsPriceEdit = Boolean(dbItem.brandId && dbItem.brandId.allowSalesmanPriceEdit);
      const isSalesmanOrder = req.user.role === 'Salesman' || order.createdByRole === 'Salesman';
      if (isSalesmanOrder && brandAllowsPriceEdit && itemInput.price !== undefined && itemInput.price !== null && itemInput.price !== '') {
        const customPrice = Number(itemInput.price);
        if (!isNaN(customPrice) && customPrice >= 0) {
          price = Math.round(customPrice * 100) / 100;
        }
      } else if (req.user.role === 'Admin' && itemInput.price !== undefined && itemInput.price !== null && itemInput.price !== '') {
        const customPrice = Number(itemInput.price);
        if (!isNaN(customPrice) && customPrice >= 0) {
          price = Math.round(customPrice * 100) / 100;
        }
      }

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
    .populate('superStockist', 'name email')
    .populate('shopId', 'name ownerName phone address')
    .populate('cancelledBy', 'name email role');

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

  if (order.status === 'Cancelled') {
    return res.status(400).json({ message: 'Cancelled orders cannot be marked as delivered.' });
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
    .populate('superStockist', 'name email')
    .populate('shopId', 'name ownerName phone address')
    .populate('cancelledBy', 'name email role');

  res.json(updatedOrder);
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private (Salesman, Distributor, Super Stockist, Admin, ASM, ASE)
const deleteOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  if (req.user.role !== 'Admin') {
    const isCreator = String(order.createdBy) === String(req.user._id);
    const isASMForDistributor = req.user.role === 'ASM' && String(order.distributor) === String(req.user.distributorId);
    const isASEForSS = req.user.role === 'ASE' && String(order.superStockist) === String(req.user.superStockistId);
    const isDistributorOwner = req.user.role === 'Distributor' && String(order.distributor) === String(req.user._id);
    const isSSOwner = req.user.role === 'Super Stockist' && String(order.superStockist) === String(req.user._id);

    if (!isCreator && !isASMForDistributor && !isASEForSS && !isDistributorOwner && !isSSOwner) {
      return res.status(403).json({ message: 'You can only delete orders created by you or for your entity.' });
    }

    if (order.status === 'Delivered') {
      return res.status(400).json({ message: 'Delivered orders cannot be deleted.' });
    }
  }

  await Order.deleteOne({ _id: order._id });
  res.json({ message: 'Order deleted successfully' });
};

// @desc    Cancel order (Order creator or Admin)
// @route   PUT /api/orders/:id/cancel
// @access  Private (Salesman, Distributor, Super Stockist, Admin, ASM, ASE)
const cancelOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  if (order.status === 'Cancelled') {
    return res.status(400).json({ message: 'Order is already cancelled' });
  }

  if (order.status === 'Delivered') {
    return res.status(400).json({ message: 'Delivered orders cannot be cancelled' });
  }

  const isAdmin = req.user.role === 'Admin';
  const isCreator = String(order.createdBy) === String(req.user._id);

  if (!isAdmin && !isCreator) {
    return res.status(403).json({ message: 'Only the order creator or an Admin can cancel this order.' });
  }

  const { reason } = req.body;

  order.status = 'Cancelled';
  order.cancelledAt = new Date();
  order.cancelledBy = req.user._id;
  order.cancelledByRole = req.user.role;
  if (reason && typeof reason === 'string' && reason.trim()) {
    order.cancellationReason = reason.trim();
  }

  await order.save();

  const fullOrder = await Order.findById(order._id)
    .populate('createdBy', 'name email role')
    .populate('orderTo', 'name email role')
    .populate('salesman', 'name email')
    .populate('distributor', 'name email')
    .populate('superStockist', 'name email')
    .populate('shopId', 'name ownerName phone address')
    .populate('cancelledBy', 'name email role');

  res.json(fullOrder);
};

// @desc    Factory reset - Delete all orders in the system (Admin only)
// @route   DELETE /api/orders/factory-reset
// @access  Private (Admin only)
const factoryResetOrders = async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Access denied. Only Admins can perform factory reset.' });
  }

  const orderCount = await Order.countDocuments();
  await Order.deleteMany({});
  await Counter.deleteMany({ id: { $regex: '^ORDER_' } });

  res.json({
    message: `Factory reset successful. All ${orderCount} orders have been deleted.`,
    deletedCount: orderCount,
  });
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  updateDeliveryStatus,
  deleteOrder,
  cancelOrder,
  factoryResetOrders,
};
