const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  sale_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  payment_gateway: {
    type: DataTypes.STRING,
    allowNull: false
  },
  transaction_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'failed'),
    defaultValue: 'pending'
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'transactions',
  timestamps: true
});

module.exports = Transaction;
