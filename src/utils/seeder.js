const bcrypt = require('bcryptjs');
const { User, Product, Store } = require('../models');

const seedDatabase = async () => {
  try {
    // 1. Seed Users (Admin, Ombor, and Agents)
    const userCount = await User.count();
    if (userCount === 0) {
      console.log('Seeding default users...');
      const salt = await bcrypt.genSalt(10);
      const adminHash = await bcrypt.hash('admin', salt);
      const omborHash = await bcrypt.hash('ombor', salt);
      const agentHash = await bcrypt.hash('123', salt);

      // Create Admin
      await User.create({
        username: 'admin',
        name: 'Bosh Admin',
        password_hash: adminHash,
        role: 'admin',
        phone: '+998 90 000 00 00'
      });

      // Create Warehouse Manager
      await User.create({
        username: 'ombor',
        name: 'Ombor Mudiri',
        password_hash: omborHash,
        role: 'warehouse_manager',
        phone: '+998 90 111 11 11'
      });

      // Create Agent 1 (Sherzod Alimov)
      await User.create({
        id: 2,
        username: 'sherzod_agent',
        name: 'Sherzod Alimov',
        password_hash: agentHash,
        role: 'agent',
        phone: '+998 94 333 22 11'
      });

      // Create Agent 2 (Malika Qodirova)
      await User.create({
        id: 3,
        username: 'malika_agent',
        name: 'Malika Qodirova',
        password_hash: agentHash,
        role: 'agent',
        phone: '+998 97 777 55 44'
      });
      console.log('Users seeded successfully!');
    }

    // 2. Seed Products
    const productCount = await Product.count();
    if (productCount === 0) {
      console.log('Seeding default products...');
      await Product.bulkCreate([
        { id: 1, barcode: '48200001', name: 'IQOS Iluma One (Pebble Grey)', price: 350000, original_price: 300000, unit: 'dona', stock: 150 },
        { id: 2, barcode: '48200002', name: 'Heets Amber Selection', price: 18000, original_price: 15000, unit: 'blok', stock: 1200 },
        { id: 3, barcode: '48200003', name: 'IQOS Terea Silver', price: 22000, original_price: 19000, unit: 'blok', stock: 800 },
        { id: 4, barcode: '48200004', name: 'Fiit Regular', price: 17000, original_price: 14000, unit: 'blok', stock: 650 }
      ]);
      console.log('Products seeded successfully!');
    }

    // 3. Seed Stores
    const storeCount = await Store.count();
    if (storeCount === 0) {
      console.log('Seeding default stores...');
      await Store.bulkCreate([
        { id: 14489, name: "G'ofur Ota Mini Market", owner_name: "G'ofurjon akam", phone: '+998 90 123 45 67', address: 'Toshkent sh., Chilonzor 6-daha', map_link: 'https://maps.google.com/?q=41.2842,69.1863', location_lat: '41.2842', location_lng: '69.1863' },
        { id: 57196, name: 'Premium Smoke Shop', owner_name: 'Davronbek', phone: '+998 93 543 21 09', address: "Toshkent sh., Amir Temur ko'chasi 12", map_link: 'https://maps.google.com/?q=41.3113,69.2797', location_lat: '41.3113', location_lng: '69.2797' },
        { id: 53110, name: "24/7 Baza Do'kon", owner_name: 'Azamat', phone: '+998 99 999 88 77', address: 'Toshkent sh., Yunusobod 11-kvartal', map_link: 'https://maps.google.com/?q=41.3654,69.2891', location_lat: '41.3654', location_lng: '69.2891' }
      ]);
      console.log('Stores seeded successfully!');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

module.exports = { seedDatabase };
