const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'agent', 'warehouse_manager'),
    allowNull: false,
    defaultValue: 'agent'
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  terminal_sn: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  tinda_ip: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tinda_login: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tinda_pin: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tinda_default_mxik: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tinda_default_package: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tinda_test_mode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  timestamps: true
});

module.exports = User;
