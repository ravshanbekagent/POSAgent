const { Sequelize } = require('sequelize');
require('dotenv').config();

const dialectOptions = {};

// Enable SSL for cloud database hosts (Neon, Render) or in production
if (
  process.env.NODE_ENV === 'production' ||
  (process.env.DB_HOST && (process.env.DB_HOST.includes('neon.tech') || process.env.DB_HOST.includes('render.com')))
) {
  dialectOptions.ssl = {
    require: true,
    rejectUnauthorized: false
  };
}

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    dialectOptions,
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

module.exports = sequelize;

