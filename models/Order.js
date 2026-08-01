const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
  },
  itemName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdByRole: {
      type: String,
      required: true,
      enum: ['Admin', 'Super Stockist', 'Distributor', 'Salesman'],
    },
    orderTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderFrom: {
      type: String,
      required: [true, 'Shop name (Order From) is required'],
      trim: true,
    },
    salesman: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    superStockist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    products: {
      type: [orderItemSchema],
      validate: [
        function (val) {
          return val.length > 0;
        },
        'Order must contain at least one item',
      ],
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Delivered'],
      default: 'Pending',
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Order', orderSchema);
