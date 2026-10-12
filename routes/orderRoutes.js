const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  updateDeliveryStatus,
  deleteOrder,
  cancelOrder,
  factoryResetOrders,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .post(authorize('Salesman', 'Distributor', 'Super Stockist', 'Admin', 'ASM', 'ASE'), createOrder)
  .get(getOrders);

// Factory reset all orders (Admin only) - MUST be defined before /:id to prevent matching as id parameter
router.delete('/factory-reset', authorize('Admin'), factoryResetOrders);

router.route('/:id')
  .get(getOrderById)
  .put(authorize('Salesman', 'Distributor', 'Super Stockist', 'Admin', 'ASM', 'ASE'), updateOrder)
  .delete(authorize('Salesman', 'Distributor', 'Super Stockist', 'Admin', 'ASM', 'ASE'), deleteOrder);

router.put('/:id/delivery', authorize('Distributor', 'Super Stockist', 'Admin'), updateDeliveryStatus);
router.put('/:id/cancel', authorize('Salesman', 'Distributor', 'Super Stockist', 'Admin', 'ASM', 'ASE'), cancelOrder);

module.exports = router;
