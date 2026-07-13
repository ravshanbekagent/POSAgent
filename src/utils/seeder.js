const bcrypt = require('bcryptjs');
const { User, Product, Store } = require('../models');

const seedDatabase = async () => {
  try {
    // Seed Only Default Admin
    const userCount = await User.count();
    if (userCount === 0) {
      console.log('Seeding default Admin for production...');
      const salt = await bcrypt.genSalt(10);
      const adminHash = await bcrypt.hash('123456', salt);

      // Create Admin
      await User.create({
        username: 'Admin',
        name: 'Ali Umarov',
        password_hash: adminHash,
        role: 'admin',
        phone: '+998 90 000 00 00'
      });
      console.log('Admin user seeded successfully!');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

module.exports = { seedDatabase };
