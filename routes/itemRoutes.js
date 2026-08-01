const express = require('express');
const router = express.Router();
const {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
} = require('../controllers/itemController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .get(getItems)
  .post(authorize('Admin'), createItem);

router.route('/:id')
  .get(getItemById)
  .put(authorize('Admin'), updateItem)
  .delete(authorize('Admin'), deleteItem);

module.exports = router;
