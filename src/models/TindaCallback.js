const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const TindaCallback = sequelize.define('TindaCallback', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  agent_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  serial_number: {
    type: DataTypes.STRING,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  products: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending'
  },
  payload: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'tinda_callbacks',
  timestamps: true
});

module.exports = TindaCallback;
