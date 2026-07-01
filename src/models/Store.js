const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Store = sequelize.define('Store', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  owner_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  map_link: {
    type: DataTypes.STRING,
    allowNull: true
  },
  location_lat: {
    type: DataTypes.STRING,
    allowNull: true
  },
  location_lng: {
    type: DataTypes.STRING,
    allowNull: true
  },
  agent_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  assigned_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  duration_days: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'stores',
  timestamps: true
});

module.exports = Store;
