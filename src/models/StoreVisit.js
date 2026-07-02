const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const StoreVisit = sequelize.define('StoreVisit', {
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
  status: {
    type: DataTypes.ENUM('sold', 'empty'),
    allowNull: false,
    defaultValue: 'empty'
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: true
  },
  items: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  date: {
    type: DataTypes.STRING,
    allowNull: false
  },
  time: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'store_visits',
  timestamps: true
});

module.exports = StoreVisit;
