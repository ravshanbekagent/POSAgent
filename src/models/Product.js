const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  barcode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  original_price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0.00
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'dona'
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true
  },
  psid: {
    type: DataTypes.STRING,
    allowNull: true
  },
  marked: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  is_integer_units: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  package_code: {
    type: DataTypes.STRING,
    allowNull: true
  },
  inn: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pinfl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  owner_type: {
    type: DataTypes.STRING,
    defaultValue: '0'
  },
  store_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  vat: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0.12
  }
}, {
  tableName: 'products',
  timestamps: true
});

module.exports = Product;
