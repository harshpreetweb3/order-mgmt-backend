const express = require('express');
const router = express.Router();
const {
  createUser,
  getUsers,
  updateUser,
  deleteUser,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .post(authorize('Admin'), createUser)
  .get(getUsers);

router.route('/:id')
  .put(authorize('Admin'), updateUser)
  .delete(authorize('Admin'), deleteUser);

module.exports = router;
