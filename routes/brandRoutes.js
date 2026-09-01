const express = require('express');
const router = express.Router();
const {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
} = require('../controllers/brandController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router
  .route('/')
  .get(getBrands)
  .post(authorize('Admin'), createBrand);

router
  .route('/:id')
  .get(getBrandById)
  .put(authorize('Admin'), updateBrand)
  .delete(authorize('Admin'), deleteBrand);

module.exports = router;
