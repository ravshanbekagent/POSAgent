const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: 'text/plain', limit: '10mb' }));

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const storeRoutes = require('./routes/storeRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const salesRoutes = require('./routes/salesRoutes');
const tindaRoutes = require('./routes/tindaRoutes');
const visitRoutes = require('./routes/visitRoutes');
const debtRoutes = require('./routes/debtRoutes');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/tinda', tindaRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/debts', debtRoutes);

// Basic test route
app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'OK', database: 'Connected', message: 'API is running' });
  } catch (err) {
    res.json({ status: 'ERROR', database: 'Disconnected', error: err.message, message: 'API is running in mock mode' });
  }
});

const { seedDatabase } = require('./utils/seeder');

// Database sync and server start
const startServer = async () => {
  try {
    // Authenticate database connection
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Sync database models
    // In production, migrations are preferred, but sync(alter: true) is perfect for initial setup
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully.');

    // Seed database with default values
    await seedDatabase();
  } catch (error) {
    console.error('Database connection failed, running in server-only/mock mode:', error.message);
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();
