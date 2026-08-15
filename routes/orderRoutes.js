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
  .post(authorize('Salesman', 'Distributor', 'Super Stockist', 'Admin', 'ASM', 'ASE'), createOrder)
  .get(getOrders);

router.route('/:id')
  .get(getOrderById)
  .put(authorize('Salesman', 'Distributor', 'Super Stockist', 'Admin', 'ASM', 'ASE'), updateOrder)
  .delete(authorize('Salesman', 'Distributor', 'Super Stockist', 'Admin', 'ASM', 'ASE'), deleteOrder);

router.put('/:id/delivery', authorize('Distributor', 'Super Stockist', 'Admin'), updateDeliveryStatus);

module.exports = router;
