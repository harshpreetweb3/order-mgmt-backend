const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Item = require('../models/Item');
const Order = require('../models/Order');
const Counter = require('../models/Counter');

dotenv.config();

const seedData = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('🌱 Database already contains data. Skipping seed.');
      return;
    }

    console.log('🌱 Seeding initial data...');

    // 1. Create Super Stockist
    const superStockist = await User.create({
      name: 'Apex Logistics SS',
      email: 'ss@ordermanager.com',
      password: 'ss1234',
      role: 'Super Stockist',
      status: 'Active',
    });

    // 2. Create Admin
    const admin = await User.create({
      name: 'System Admin',
      email: 'admin@ordermanager.com',
      password: 'admin123',
      role: 'Admin',
      status: 'Active',
    });

    // 3. Create Distributor
    const distributor = await User.create({
      name: 'Metro Trade Distributors',
      email: 'dist@ordermanager.com',
      password: 'dist123',
      role: 'Distributor',
      superStockistId: superStockist._id,
      status: 'Active',
    });

    // 4. Create Salesman
    const salesman = await User.create({
      name: 'John Salesman',
      email: 'sales@ordermanager.com',
      password: 'sales123',
      role: 'Salesman',
      distributorId: distributor._id,
      status: 'Active',
    });

    // 5. Create Items Master
    const items = await Item.insertMany([
      { itemName: 'Premium Basmati Rice 10kg', price: 850, sku: 'SKU-RICE-10', active: true },
      { itemName: 'Fortune Refined Oil 5L', price: 620, sku: 'SKU-OIL-05', active: true },
      { itemName: 'Pure Organic Sugar 1kg', price: 55, sku: 'SKU-SUG-01', active: true },
      { itemName: 'Assam Premium Tea 500g', price: 240, sku: 'SKU-TEA-500', active: true },
      { itemName: 'Whole Wheat Atta 5kg', price: 210, sku: 'SKU-ATTA-05', active: true },
      { itemName: 'Dark Chocolate Cookies Box', price: 150, sku: 'SKU-CK-150', active: true },
    ]);

    // 6. Create Counter
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    await Counter.create({ id: `ORDER_${dateStr}`, seq: 2 });

    // 7. Create Sample Orders
    // Order 1: Salesman -> Distributor (Pending)
    const order1 = await Order.create({
      orderNumber: `ORD-${dateStr}-0001`,
      createdBy: salesman._id,
      createdByRole: 'Salesman',
      orderTo: distributor._id,
      orderFrom: 'Sunrise Supermarket, MG Road',
      salesman: salesman._id,
      distributor: distributor._id,
      products: [
        {
          itemId: items[0]._id,
          itemName: items[0].itemName,
          quantity: 5,
          price: items[0].price,
          total: 5 * items[0].price,
        },
        {
          itemId: items[1]._id,
          itemName: items[1].itemName,
          quantity: 2,
          price: items[1].price,
          total: 2 * items[1].price,
        },
      ],
      grandTotal: 5 * items[0].price + 2 * items[1].price, // 4250 + 1240 = 5490
      status: 'Pending',
    });

    // Order 2: Distributor -> Super Stockist (Delivered)
    const order2 = await Order.create({
      orderNumber: `ORD-${dateStr}-0002`,
      createdBy: distributor._id,
      createdByRole: 'Distributor',
      orderTo: superStockist._id,
      orderFrom: 'Metro Central Depot Store',
      distributor: distributor._id,
      superStockist: superStockist._id,
      products: [
        {
          itemId: items[2]._id,
          itemName: items[2].itemName,
          quantity: 50,
          price: items[2].price,
          total: 50 * items[2].price,
        },
        {
          itemId: items[4]._id,
          itemName: items[4].itemName,
          quantity: 30,
          price: items[4].price,
          total: 30 * items[4].price,
        },
      ],
      grandTotal: 50 * items[2].price + 30 * items[4].price, // 2750 + 6300 = 9050
      status: 'Delivered',
      deliveredAt: new Date(),
    });

    console.log('✅ Initial Seed Data Created Successfully!');
    console.log('----------------------------------------------------');
    console.log('🔑 Seed Credentials:');
    console.log('  - Admin:         admin@ordermanager.com / admin123');
    console.log('  - Super Stockist: ss@ordermanager.com    / ss123');
    console.log('  - Distributor:    dist@ordermanager.com  / dist123');
    console.log('  - Salesman:       sales@ordermanager.com / sales123');
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error('❌ Error Seeding Data:', error.message);
  }
};

if (require.main === module) {
  const connectDB = require('../config/db');
  connectDB().then(() => seedData().then(() => process.exit(0)));
} else {
  module.exports = { seedData };
}
