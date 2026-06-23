const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Sale = sequelize.define('Sale', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  agent_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  store_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  total_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
    defaultValue: 'pending'
  }
}, {
  tableName: 'sales',
  timestamps: true
});

module.exports = Sale;
