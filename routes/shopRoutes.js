const express = require('express');
const router = express.Router();
const {
  getShops,
  getShopById,
  createShop,
  updateShop,
  deleteShop,
} = require('../controllers/shopController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router
  .route('/')
  .get(getShops)
  .post(authorize('Salesman', 'Distributor', 'Admin'), createShop);

router
  .route('/:id')
  .get(getShopById)
  .put(authorize('Salesman', 'Distributor', 'Admin'), updateShop)
  .delete(authorize('Salesman', 'Distributor', 'Admin'), deleteShop);

module.exports = router;
