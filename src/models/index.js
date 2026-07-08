const User = require('./User');
const Product = require('./Product');
const Store = require('./Store');
const AgentInventory = require('./AgentInventory');
const Sale = require('./Sale');
const SaleItem = require('./SaleItem');
const Transaction = require('./Transaction');
const StoreVisit = require('./StoreVisit');
const Debt = require('./Debt');
const DebtPayment = require('./DebtPayment');

// Define associations

// User <-> AgentInventory
User.hasMany(AgentInventory, { foreignKey: 'agent_id', as: 'inventories' });
AgentInventory.belongsTo(User, { foreignKey: 'agent_id', as: 'agent' });

// Product <-> AgentInventory
Product.hasMany(AgentInventory, { foreignKey: 'product_id', as: 'inventories' });
AgentInventory.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// User <-> Sale
User.hasMany(Sale, { foreignKey: 'agent_id', as: 'sales' });
Sale.belongsTo(User, { foreignKey: 'agent_id', as: 'agent' });

// Store <-> Sale
Store.hasMany(Sale, { foreignKey: 'store_id', as: 'sales' });
Sale.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });

// Sale <-> SaleItem
Sale.hasMany(SaleItem, { foreignKey: 'sale_id', as: 'items' });
SaleItem.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });

// Product <-> SaleItem
Product.hasMany(SaleItem, { foreignKey: 'product_id', as: 'sale_items' });
SaleItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Sale <-> Transaction
Sale.hasOne(Transaction, { foreignKey: 'sale_id', as: 'transaction' });
Transaction.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });

// User <-> StoreVisit
User.hasMany(StoreVisit, { foreignKey: 'agent_id', as: 'visits' });
StoreVisit.belongsTo(User, { foreignKey: 'agent_id', as: 'agent' });

// Store <-> StoreVisit
Store.hasMany(StoreVisit, { foreignKey: 'store_id', as: 'visits' });
StoreVisit.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });

// Sale <-> Debt
Sale.hasOne(Debt, { foreignKey: 'sale_id', as: 'debt' });
Debt.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });

// Store <-> Debt
Store.hasMany(Debt, { foreignKey: 'store_id', as: 'debts' });
Debt.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });

// User <-> Debt
User.hasMany(Debt, { foreignKey: 'agent_id', as: 'debts' });
Debt.belongsTo(User, { foreignKey: 'agent_id', as: 'agent' });

// Debt <-> DebtPayment
Debt.hasMany(DebtPayment, { foreignKey: 'debt_id', as: 'payments' });
DebtPayment.belongsTo(Debt, { foreignKey: 'debt_id', as: 'debt' });

// User <-> DebtPayment
User.hasMany(DebtPayment, { foreignKey: 'agent_id', as: 'debt_payments' });
DebtPayment.belongsTo(User, { foreignKey: 'agent_id', as: 'agent' });

module.exports = {
  sequelize: require('../config/db'),
  User,
  Product,
  Store,
  AgentInventory,
  Sale,
  SaleItem,
  Transaction,
  StoreVisit,
  Debt,
  DebtPayment
};

