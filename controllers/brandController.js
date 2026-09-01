const Brand = require('../models/Brand');

// @desc    Get all brands
// @route   GET /api/brands
// @access  Private
const getBrands = async (req, res) => {
  const { activeOnly } = req.query;
  const filter = {};
  if (activeOnly === 'true') {
    filter.active = true;
  }

  const brands = await Brand.find(filter).sort({ name: 1 });
  res.json(brands);
};

// @desc    Get single brand
// @route   GET /api/brands/:id
// @access  Private
const getBrandById = async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) {
    return res.status(404).json({ message: 'Brand not found' });
  }
  res.json(brand);
};

// @desc    Create new brand
// @route   POST /api/brands
// @access  Private (Admin)
const createBrand = async (req, res) => {
  const { name, description, active } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Brand name is required' });
  }

  const existing = await Brand.findOne({ name: name.trim() });
  if (existing) {
    return res.status(400).json({ message: 'Brand with this name already exists' });
  }

  const brand = await Brand.create({
    name: name.trim(),
    description: description ? description.trim() : '',
    active: active !== undefined ? active : true,
  });

  res.status(201).json(brand);
};

// @desc    Update brand
// @route   PUT /api/brands/:id
// @access  Private (Admin)
const updateBrand = async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) {
    return res.status(404).json({ message: 'Brand not found' });
  }

  const { name, description, active } = req.body;

  if (name && name.trim() !== brand.name) {
    const existing = await Brand.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Brand with this name already exists' });
    }
    brand.name = name.trim();
  }

  if (description !== undefined) brand.description = description.trim();
  if (active !== undefined) brand.active = active;

  const updatedBrand = await brand.save();
  res.json(updatedBrand);
};

// @desc    Delete brand
// @route   DELETE /api/brands/:id
// @access  Private (Admin)
const deleteBrand = async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) {
    return res.status(404).json({ message: 'Brand not found' });
  }

  await Brand.deleteOne({ _id: brand._id });
  res.json({ message: 'Brand deleted successfully' });
};

module.exports = {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
};
