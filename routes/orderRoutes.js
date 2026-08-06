const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  updateDeliveryStatus,
  deleteOrder,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .post(authorize('Salesman', 'Distributor', 'Super Stockist', 'Admin'), createOrder)
  .get(getOrders);

router.route('/:id')
  .get(getOrderById)
  .put(authorize('Salesman', 'Distributor', 'Super Stockist', 'Admin'), updateOrder)
  .delete(authorize('Salesman', 'Distributor', 'Super Stockist', 'Admin'), deleteOrder);

router.put('/:id/delivery', authorize('Distributor', 'Super Stockist', 'Admin'), updateDeliveryStatus);

module.exports = router;
