const Shop = require('../models/Shop');

// @desc    Get shops
// @route   GET /api/shops
// @access  Private
const getShops = async (req, res) => {
  const filter = { active: true };

  if (req.user.role === 'Salesman') {
    filter.$or = [
      { createdBy: req.user._id },
      { distributor: req.user.distributorId }
    ];
  } else if (req.user.role === 'Distributor') {
    filter.distributor = req.user._id;
  }

  const shops = await Shop.find(filter)
    .populate('distributor', 'name email')
    .populate('createdBy', 'name email role')
    .sort({ name: 1 });

  res.json(shops);
};

// @desc    Get single shop
// @route   GET /api/shops/:id
// @access  Private
const getShopById = async (req, res) => {
  const shop = await Shop.findById(req.params.id)
    .populate('distributor', 'name email')
    .populate('createdBy', 'name email role');

  if (!shop) {
    return res.status(404).json({ message: 'Shop not found' });
  }
  res.json(shop);
};

// @desc    Create new shop
// @route   POST /api/shops
// @access  Private (Salesman, Distributor, Admin)
const createShop = async (req, res) => {
  const { name, ownerName, phone, address } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Shop name is required' });
  }

  let distributorId = null;
  if (req.user.role === 'Salesman') {
    distributorId = req.user.distributorId || null;
  } else if (req.user.role === 'Distributor') {
    distributorId = req.user._id;
  }

  const shop = await Shop.create({
    name: name.trim(),
    ownerName: ownerName ? ownerName.trim() : '',
    phone: phone ? phone.trim() : '',
    address: address ? address.trim() : '',
    distributor: distributorId,
    createdBy: req.user._id,
    active: true,
  });

  const fullShop = await Shop.findById(shop._id)
    .populate('distributor', 'name email')
    .populate('createdBy', 'name email role');

  res.status(201).json(fullShop);
};

// @desc    Update shop
// @route   PUT /api/shops/:id
// @access  Private (Salesman, Distributor, Admin)
const updateShop = async (req, res) => {
  const shop = await Shop.findById(req.params.id);
  if (!shop) {
    return res.status(404).json({ message: 'Shop not found' });
  }

  const { name, ownerName, phone, address, active } = req.body;

  if (name) shop.name = name.trim();
  if (ownerName !== undefined) shop.ownerName = ownerName.trim();
  if (phone !== undefined) shop.phone = phone.trim();
  if (address !== undefined) shop.address = address.trim();
  if (active !== undefined) shop.active = active;

  await shop.save();

  const fullShop = await Shop.findById(shop._id)
    .populate('distributor', 'name email')
    .populate('createdBy', 'name email role');

  res.json(fullShop);
};

// @desc    Delete shop
// @route   DELETE /api/shops/:id
// @access  Private (Salesman, Distributor, Admin)
const deleteShop = async (req, res) => {
  const shop = await Shop.findById(req.params.id);
  if (!shop) {
    return res.status(404).json({ message: 'Shop not found' });
  }

  await Shop.deleteOne({ _id: shop._id });
  res.json({ message: 'Shop removed successfully' });
};

module.exports = {
  getShops,
  getShopById,
  createShop,
  updateShop,
  deleteShop,
};
