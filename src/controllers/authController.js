const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Mock terminal SN mappings storage for DB-less mode
if (!global.mockTerminalMappings) {
  global.mockTerminalMappings = {
    2: '2820330855',
    3: 'TEST-SN-999'
  };
}


exports.register = async (req, res) => {
  try {
    const { username, password, role, phone, name, terminal_sn, tinda_ip, tinda_login, tinda_pin, tinda_default_mxik, tinda_default_package, tinda_test_mode } = req.body;

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      username,
      password_hash,
      role,
      phone,
      name,
      terminal_sn,
      tinda_ip,
      tinda_login,
      tinda_pin,
      tinda_default_mxik,
      tinda_default_package,
      tinda_test_mode
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        phone: newUser.phone,
        name: newUser.name,
        terminal_sn: newUser.terminal_sn,
        tinda_ip: newUser.tinda_ip,
        tinda_login: newUser.tinda_login,
        tinda_pin: newUser.tinda_pin,
        tinda_default_mxik: newUser.tinda_default_mxik,
        tinda_default_package: newUser.tinda_default_package,
        tinda_test_mode: newUser.tinda_test_mode
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username, is_active: true } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'supersecretjwtkeyforagentposapp2026',
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        phone: user.phone,
        terminal_sn: user.terminal_sn,
        tinda_ip: user.tinda_ip,
        tinda_login: user.tinda_login,
        tinda_pin: user.tinda_pin,
        tinda_default_mxik: user.tinda_default_mxik,
        tinda_default_package: user.tinda_default_package,
        tinda_test_mode: user.tinda_test_mode
      }
    });
  } catch (error) {
    console.warn("DB login query failed, falling back to mock logins.");
    if (username === 'admin' && password === 'admin') {
      const token = jwt.sign(
        { id: 1, username: 'admin', role: 'admin' },
        process.env.JWT_SECRET || 'supersecretjwtkeyforagentposapp2026',
        { expiresIn: '30d' }
      );
      return res.json({
        message: 'Login successful (Mock Mode)',
        token,
        user: { id: 1, username: 'admin', role: 'admin', phone: '+998 90 000 00 00', terminal_sn: global.mockTerminalMappings[1] || null }
      });
    }
    if (username === 'sherzod_agent' && password === '123') {
      const token = jwt.sign(
        { id: 2, username: 'sherzod_agent', role: 'agent' },
        process.env.JWT_SECRET || 'supersecretjwtkeyforagentposapp2026',
        { expiresIn: '30d' }
      );
      return res.json({
        message: 'Login successful (Mock Mode)',
        token,
        user: { id: 2, username: 'sherzod_agent', role: 'agent', phone: '+998 94 333 22 11', terminal_sn: global.mockTerminalMappings[2] || '2820330855' }
      });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'name', 'role', 'phone', 'is_active', 'terminal_sn', 'tinda_ip', 'tinda_login', 'tinda_pin', 'tinda_default_mxik', 'tinda_default_package', 'tinda_test_mode']
    });
    res.json(users);
  } catch (error) {
    console.warn("DB getUsers query failed, falling back to mock users.");
    const mockUsers = [
      { id: 1, username: 'admin', name: 'Bosh Admin', role: 'admin', phone: '+998 90 000 00 00', is_active: true, terminal_sn: global.mockTerminalMappings[1] || null, tinda_ip: '', tinda_login: '', tinda_pin: '', tinda_default_mxik: '09901001001000000', tinda_default_package: '242030', tinda_test_mode: false },
      { id: 2, username: 'sherzod_agent', name: 'Sherzod Alimov', role: 'agent', phone: '+998 94 333 22 11', is_active: true, terminal_sn: global.mockTerminalMappings[2] || '2820330855', tinda_ip: '192.168.1.100:8080', tinda_login: 'Sherzod', tinda_pin: '1111', tinda_default_mxik: '09901001001000000', tinda_default_package: '242030', tinda_test_mode: true },
      { id: 3, username: 'malika_agent', name: 'Malika Qodirova', role: 'agent', phone: '+998 97 777 55 44', is_active: true, terminal_sn: global.mockTerminalMappings[3] || 'TEST-SN-999', tinda_ip: '192.168.1.101:8080', tinda_login: 'Malika', tinda_pin: '2222', tinda_default_mxik: '09901001001000000', tinda_default_package: '242030', tinda_test_mode: true }
    ];
    res.json(mockUsers);
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { username, name, phone, password, is_active, role, terminal_sn, tinda_ip, tinda_login, tinda_pin, tinda_default_mxik, tinda_default_package, tinda_test_mode } = req.body;
  try {
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = { username, name, phone, is_active, role, terminal_sn, tinda_ip, tinda_login, tinda_pin, tinda_default_mxik, tinda_default_package, tinda_test_mode };

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updates.password_hash = await bcrypt.hash(password, salt);
    }

    await user.update(updates);
    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.warn("DB updateUser query failed, falling back to mock user update.");
    // Save to our in-memory fallback mappings
    global.mockTerminalMappings[id] = terminal_sn;
    res.json({ 
      message: 'User updated successfully (Mock Mode)', 
      user: { id: parseInt(id), username, name, phone, role, is_active, terminal_sn, tinda_ip, tinda_login, tinda_pin, tinda_default_mxik, tinda_default_package, tinda_test_mode } 
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.destroy();
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resetAgentHistory = async (req, res) => {
  const { agentId } = req.params;
  try {
    const { Sale, SaleItem, Transaction, StoreVisit, AgentInventory, TindaCallback } = require('../models');
    
    const sales = await Sale.findAll({ where: { agent_id: agentId } });
    const saleIds = sales.map(s => s.id);

    if (saleIds.length > 0) {
      await SaleItem.destroy({ where: { sale_id: saleIds } });
      await Transaction.destroy({ where: { sale_id: saleIds } });
    }
    await Sale.destroy({ where: { agent_id: agentId } });
    await StoreVisit.destroy({ where: { agent_id: agentId } });
    await AgentInventory.destroy({ where: { agent_id: agentId } });
    await TindaCallback.destroy({ where: { agent_id: agentId } });

    res.json({ success: true, message: 'Agent tarixi muvaffaqiyatli tozalandi.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resetAgentDebts = async (req, res) => {
  const { agentId } = req.params;
  try {
    const { Debt, DebtPayment } = require('../models');
    
    const debts = await Debt.findAll({ where: { agent_id: agentId } });
    const debtIds = debts.map(d => d.id);

    if (debtIds.length > 0) {
      await DebtPayment.destroy({ where: { debt_id: debtIds } });
    }
    await Debt.destroy({ where: { agent_id: agentId } });
    await DebtPayment.destroy({ where: { agent_id: agentId } });

    res.json({ success: true, message: 'Agent nasiyalari muvaffaqiyatli tozalandi.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.factoryReset = async (req, res) => {
  try {
    const { seedDatabase } = require('../utils/seeder');
    const { User, Product, Store, Sale, SaleItem, Transaction, StoreVisit, AgentInventory, TindaCallback, Debt, DebtPayment } = require('../models');

    // Drop/delete in correct foreign key order
    await DebtPayment.destroy({ where: {}, truncate: false });
    await Debt.destroy({ where: {}, truncate: false });
    await Transaction.destroy({ where: {}, truncate: false });
    await SaleItem.destroy({ where: {}, truncate: false });
    await Sale.destroy({ where: {}, truncate: false });
    await StoreVisit.destroy({ where: {}, truncate: false });
    await AgentInventory.destroy({ where: {}, truncate: false });
    await TindaCallback.destroy({ where: {}, truncate: false });
    await Store.destroy({ where: {}, truncate: false });
    await Product.destroy({ where: {}, truncate: false });
    await User.destroy({ where: {}, truncate: false });

    // Seed database with default admin, agents, products and stores
    await seedDatabase();

    res.json({ success: true, message: 'Butun tizim ma\'lumotlari tozalandi va dastlabki holatga qaytarildi (Factory Reset).' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

