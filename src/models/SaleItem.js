const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SaleItem = sequelize.define('SaleItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  sale_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  unit_price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  }
}, {
  tableName: 'sale_items',
  timestamps: true
});

module.exports = SaleItem;
