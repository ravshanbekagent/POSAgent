const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DebtPayment = sequelize.define('DebtPayment', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  debt_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  agent_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'debt_payments',
  timestamps: true
});

module.exports = DebtPayment;
