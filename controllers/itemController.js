const Item = require('../models/Item');

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

  const items = await Item.find(filter).sort({ itemName: 1 });
  res.json(items);
};

// @desc    Get single item details
// @route   GET /api/items/:id
// @access  Private
const getItemById = async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) {
    return res.status(404).json({ message: 'Item not found' });
  }
  res.json(item);
};

// @desc    Create product item
// @route   POST /api/items
// @access  Private (Admin)
const createItem = async (req, res) => {
  const { itemName, price, sku, active } = req.body;

  if (!itemName || price === undefined) {
    return res.status(400).json({ message: 'Item name and price are required' });
  }

  const existingItem = await Item.findOne({ itemName });
  if (existingItem) {
    return res.status(400).json({ message: 'An item with this name already exists' });
  }

  const item = await Item.create({
    itemName,
    price: Number(price),
    sku: sku || '',
    active: active !== undefined ? active : true,
  });

  res.status(201).json(item);
};

// @desc    Update product item
// @route   PUT /api/items/:id
// @access  Private (Admin)
const updateItem = async (req, res) => {
  const item = await Item.findById(req.params.id);

  if (!item) {
    return res.status(404).json({ message: 'Item not found' });
  }

  const { itemName, price, sku, active } = req.body;

  if (itemName) item.itemName = itemName;
  if (price !== undefined) item.price = Number(price);
  if (sku !== undefined) item.sku = sku;
  if (active !== undefined) item.active = active;

  const updatedItem = await item.save();
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
