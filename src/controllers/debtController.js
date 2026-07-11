const { Debt, DebtPayment, Store, User, Sale, SaleItem, Product } = require('../models');

// 1. Get all debts (Admin only)
exports.getAllDebts = async (req, res) => {
  try {
    const debtsList = await Debt.findAll({
      include: [
        { model: Store, as: 'store', attributes: ['id', 'name', 'address'] },
        { model: User, as: 'agent', attributes: ['id', 'name', 'username', 'phone'] },
        { 
          model: DebtPayment, 
          as: 'payments',
          order: [['paid_at', 'ASC']]
        },
        {
          model: Sale,
          as: 'sale',
          include: [{ model: SaleItem, as: 'items', include: [{ model: Product, as: 'product' }] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const todayStr = new Date().toISOString().split('T')[0];

    const updatedDebtsList = await Promise.all(debtsList.map(async (debt) => {
      let status = debt.status;
      if (status !== 'paid' && debt.due_date < todayStr) {
        status = 'overdue';
        if (debt.status !== 'overdue') {
          await debt.update({ status: 'overdue' });
        }
      } else if (status === 'overdue' && debt.due_date >= todayStr) {
        status = 'pending';
        await debt.update({ status: 'pending' });
      }

      return {
        ...debt.toJSON(),
        total_amount: parseFloat(debt.total_amount),
        paid_amount: parseFloat(debt.paid_amount),
        remaining_amount: parseFloat(debt.remaining_amount),
        status
      };
    }));

    return res.json(updatedDebtsList);
  } catch (error) {
    console.error("DB getAllDebts failed:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

// 2. Get debts by Agent
exports.getAgentDebts = async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const debtsList = await Debt.findAll({
      where: { agent_id: agentId },
      include: [
        { model: Store, as: 'store', attributes: ['id', 'name', 'address'] },
        { 
          model: DebtPayment, 
          as: 'payments',
          order: [['paid_at', 'ASC']]
        },
        {
          model: Sale,
          as: 'sale',
          include: [{ model: SaleItem, as: 'items', include: [{ model: Product, as: 'product' }] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const todayStr = new Date().toISOString().split('T')[0];

    const mapped = await Promise.all(debtsList.map(async (debt) => {
      let status = debt.status;
      if (status !== 'paid' && debt.due_date < todayStr) {
        status = 'overdue';
        if (debt.status !== 'overdue') {
          await debt.update({ status: 'overdue' });
        }
      }

      return {
        ...debt.toJSON(),
        total_amount: parseFloat(debt.total_amount),
        paid_amount: parseFloat(debt.paid_amount),
        remaining_amount: parseFloat(debt.remaining_amount),
        status
      };
    }));

    return res.json(mapped);
  } catch (error) {
    console.error("DB getAgentDebts failed:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

// 3. Record a payment towards a debt
exports.recordPayment = async (req, res) => {
  const { amount, payment_method } = req.body;
  const debtId = parseInt(req.params.id);
  const agentId = req.user ? req.user.id : 2;

  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Valid payment amount is required' });
  }

  try {
    const debt = await Debt.findByPk(debtId);
    if (!debt) {
      return res.status(404).json({ error: 'Debt record not found' });
    }

    const payVal = parseFloat(amount);
    const remaining = parseFloat(debt.remaining_amount);
    if (payVal > remaining) {
      return res.status(400).json({ error: `Payment amount (${payVal.toLocaleString()} UZS) cannot exceed the remaining debt (${remaining.toLocaleString()} UZS)` });
    }

    const newPaid = parseFloat(debt.paid_amount) + payVal;
    const newRemaining = Math.max(0, parseFloat(debt.total_amount) - newPaid);
    const newStatus = newRemaining === 0 ? 'paid' : (debt.due_date < new Date().toISOString().split('T')[0] ? 'overdue' : 'pending');

    await debt.update({
      paid_amount: newPaid,
      remaining_amount: newRemaining,
      status: newStatus
    });

    await DebtPayment.create({
      debt_id: debtId,
      amount: payVal,
      agent_id: agentId,
      payment_method: payment_method || 'naqd'
    });

    return res.json({ success: true, message: 'Payment recorded successfully', remaining: newRemaining });
  } catch (error) {
    console.error("DB recordPayment failed:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

// 4. Dangerously clean all database transaction tables
exports.cleanDatabase = async (req, res) => {
  try {
    const { Debt, DebtPayment, Sale, SaleItem, Transaction, StoreVisit } = require('../models');
    
    const dpCount = await DebtPayment.destroy({ where: {}, force: true });
    const dCount = await Debt.destroy({ where: {}, force: true });
    const txCount = await Transaction.destroy({ where: {}, force: true });
    const siCount = await SaleItem.destroy({ where: {}, force: true });
    const sCount = await Sale.destroy({ where: {}, force: true });
    const svCount = await StoreVisit.destroy({ where: {}, force: true });

    return res.json({ 
      success: true, 
      message: "Database tables cleaned successfully",
      deleted: {
        debtPayments: dpCount,
        debts: dCount,
        transactions: txCount,
        saleItems: siCount,
        sales: sCount,
        storeVisits: svCount
      }
    });
  } catch (error) {
    console.error("cleanDatabase error:", error);
    return res.status(500).json({ error: error.message });
  }
};
