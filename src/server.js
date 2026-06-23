const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const storeRoutes = require('./routes/storeRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const salesRoutes = require('./routes/salesRoutes');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);

// Basic test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API is running' });
});

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

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database or start server:', error);
  }
};

startServer();
