const Item = require('../models/Item');
const User = require('../models/User');

// Helper to determine brand restrictions based on Super Stockist chain
const getAuthorizedBrandIds = async (user) => {
  if (user.role === 'Admin') return null; // No restriction for Admin

  let ssUser = null;

  if (user.role === 'Super Stockist') {
    ssUser = user;
  } else if (user.role === 'ASE') {
    if (user.superStockistId) {
      ssUser = await User.findById(user.superStockistId);
    }
  } else if (user.role === 'Distributor' || user.role === 'ASM') {
    const distId = user.role === 'Distributor' ? user._id : user.distributorId;
    if (distId) {
      const distUser = await User.findById(distId);
      if (distUser && distUser.superStockistId) {
        ssUser = await User.findById(distUser.superStockistId);
      }
    }
  } else if (user.role === 'Salesman') {
    if (user.distributorId) {
      const distUser = await User.findById(user.distributorId);
      if (distUser && distUser.superStockistId) {
        ssUser = await User.findById(distUser.superStockistId);
      }
    }
  }

  if (ssUser && ssUser.assignedBrands && ssUser.assignedBrands.length > 0) {
    return ssUser.assignedBrands.map((b) => b.toString());
  }

  return null; // Null means all items allowed
};

// @desc    Get items list
// @route   GET /api/items
// @access  Private
const getItems = async (req, res) => {
  const { activeOnly } = req.query;
  const filter = {};

  // Non-admins only see active items by default
  if (req.user.role !== 'Admin' || activeOnly === 'true') {
    filter.active = true;
  }

  // Filter items by authorized brands for downline SS
  const allowedBrandIds = await getAuthorizedBrandIds(req.user);
  if (allowedBrandIds && allowedBrandIds.length > 0) {
    filter.$or = [
      { brandId: { $in: allowedBrandIds } },
      { brandId: null },
    ];
  }

  const items = await Item.find(filter)
    .populate('brandId', 'name active')
    .sort({ itemName: 1 });

  res.json(items);
};

// @desc    Get single item details
// @route   GET /api/items/:id
// @access  Private
const getItemById = async (req, res) => {
  const item = await Item.findById(req.params.id).populate('brandId', 'name active');
  if (!item) {
    return res.status(404).json({ message: 'Item not found' });
  }
  res.json(item);
};

// @desc    Create product item
// @route   POST /api/items
// @access  Private (Admin)
const createItem = async (req, res) => {
  const { itemName, price, sku, brandId, active } = req.body;

  if (!itemName || price === undefined) {
    return res.status(400).json({ message: 'Item name and price are required' });
  }

  const existingItem = await Item.findOne({ itemName: itemName.trim() });
  if (existingItem) {
    return res.status(400).json({ message: 'An item with this name already exists' });
  }

  const item = await Item.create({
    itemName: itemName.trim(),
    price: Number(price),
    sku: sku ? sku.trim() : '',
    brandId: brandId || null,
    active: active !== undefined ? active : true,
  });

  const fullItem = await Item.findById(item._id).populate('brandId', 'name active');
  res.status(201).json(fullItem);
};

// @desc    Update product item
// @route   PUT /api/items/:id
// @access  Private (Admin)
const updateItem = async (req, res) => {
  const item = await Item.findById(req.params.id);

  if (!item) {
    return res.status(404).json({ message: 'Item not found' });
  }

  const { itemName, price, sku, brandId, active } = req.body;

  if (itemName) item.itemName = itemName.trim();
  if (price !== undefined) item.price = Number(price);
  if (sku !== undefined) item.sku = sku.trim();
  if (brandId !== undefined) item.brandId = brandId || null;
  if (active !== undefined) item.active = active;

  await item.save();

  const updatedItem = await Item.findById(item._id).populate('brandId', 'name active');
  res.json(updatedItem);
};

// @desc    Delete product item
// @route   DELETE /api/items/:id
// @access  Private (Admin)
const deleteItem = async (req, res) => {
  const item = await Item.findById(req.params.id);

  if (!item) {
    return res.status(404).json({ message: 'Item not found' });
  }

  await Item.deleteOne({ _id: item._id });
  res.json({ message: 'Item deleted successfully' });
};

module.exports = {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
};
