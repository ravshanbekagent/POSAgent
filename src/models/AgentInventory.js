const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AgentInventory = sequelize.define('AgentInventory', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  agent_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  qty_given: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  qty_sold: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  qty_returned: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  duration_days: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  }
}, {
  tableName: 'agent_inventories',
  timestamps: true
});

module.exports = AgentInventory;
