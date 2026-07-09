const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Debt = sequelize.define('Debt', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  sale_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  store_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  agent_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  total_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  paid_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  remaining_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  due_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  given_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'overdue'),
    defaultValue: 'pending'
  },
  debtor_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  debtor_phone: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'debts',
  timestamps: true
});

module.exports = Debt;
