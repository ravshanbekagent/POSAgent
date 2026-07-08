const { Debt, DebtPayment, Store, User, Sale, SaleItem, Product } = require('../models');

// Initialize mock data memory storage if running in mock/offline mode
if (!global.mockDebts) {
  global.mockDebts = [
    {
      id: 1,
      sale_id: 991,
      store_id: 14489,
      agent_id: 2,
      total_amount: 2500000,
      paid_amount: 1000000,
      remaining_amount: 1500000,
      due_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days ago (overdue!)
      given_date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'overdue',
      store: { id: 14489, name: "G'ofur Ota Mini Market", address: "Toshkent sh., Chilonzor 6-daha" },
      agent: { id: 2, name: "Sherzod Alimov", username: "sherzod_agent", phone: "+998 94 333 22 11" },
      payments: [
        { id: 11, debt_id: 1, amount: 1000000, paid_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), agent_id: 2 }
      ],
      sale: {
        id: 991,
        total_amount: 2500000,
        items: [
          { id: 101, product_id: 1, quantity: 5, unit_price: 350000, product: { name: "IQOS Iluma One (Pebble Grey)", unit: "dona" } },
          { id: 102, product_id: 2, quantity: 41, unit_price: 18000, product: { name: "Heets Amber Selection", unit: "dona" } }
        ]
      }
    },
    {
      id: 2,
      sale_id: 992,
      store_id: 57196,
      agent_id: 2,
      total_amount: 900000,
      paid_amount: 0,
      remaining_amount: 900000,
      due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 days in future (pending)
      given_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      store: { id: 57196, name: "Premium Smoke Shop", address: "Toshkent sh., Amir Temur ko'chasi 12" },
      agent: { id: 2, name: "Sherzod Alimov", username: "sherzod_agent", phone: "+998 94 333 22 11" },
      payments: [],
      sale: {
        id: 992,
        total_amount: 900000,
        items: [
          { id: 103, product_id: 2, quantity: 50, unit_price: 18000, product: { name: "Heets Amber Selection", unit: "dona" } }
        ]
      }
    }
  ];
}

// 1. Get all debts (Admin only)
exports.getAllDebts = async (req, res) => {
  try {
    // Dynamic status update for database debts
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

    // Map through debts to update status dynamically if overdue
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

      // Convert decimal amounts to float for frontend ease
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
    console.warn("DB getAllDebts failed, using mock mode fallback:", error.message);
    
    // Check and update overdue status on mock debts dynamically
    const todayStr = new Date().toISOString().split('T')[0];
    global.mockDebts.forEach(d => {
      if (d.remaining_amount > 0) {
        if (d.due_date < todayStr) {
          d.status = 'overdue';
        } else {
          d.status = 'pending';
        }
      } else {
        d.status = 'paid';
      }
    });

    return res.json(global.mockDebts);
  }
};

// 2. Get debts by Agent (Agent read-only or self management)
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
    console.warn("DB getAgentDebts failed, using mock mode fallback:", error.message);
    const agentId = parseInt(req.params.agentId);
    
    // Filter and update mock debts
    const todayStr = new Date().toISOString().split('T')[0];
    const filtered = global.mockDebts
      .filter(d => d.agent_id === agentId)
      .map(d => {
        if (d.remaining_amount > 0) {
          if (d.due_date < todayStr) {
            d.status = 'overdue';
          } else {
            d.status = 'pending';
          }
        } else {
          d.status = 'paid';
        }
        return d;
      });

    return res.json(filtered);
  }
};

// 3. Record a payment towards a debt
exports.recordPayment = async (req, res) => {
  const { amount } = req.body;
  const debtId = parseInt(req.params.id);
  const agentId = req.user ? req.user.id : 2; // Default to agent 2 if not authenticated in fallback

  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Valid payment amount is required' });
  }

  try {
    const debt = await Debt.findByPk(debtId);
    if (!debt) {
      return res.status(404).json({ error: 'Debt record not found' });
    }

    const payVal = parseFloat(amount);
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
      agent_id: agentId
    });

    return res.json({ success: true, message: 'Payment recorded successfully', remaining: newRemaining });
  } catch (error) {
    console.warn("DB recordPayment failed, using mock mode fallback:", error.message);
    
    // Find in mock data
    const mockIndex = global.mockDebts.findIndex(d => d.id === debtId);
    if (mockIndex === -1) {
      return res.status(404).json({ error: 'Mock debt record not found' });
    }

    const mockDebt = global.mockDebts[mockIndex];
    const payVal = parseFloat(amount);
    mockDebt.paid_amount = parseFloat(mockDebt.paid_amount) + payVal;
    mockDebt.remaining_amount = Math.max(0, parseFloat(mockDebt.total_amount) - mockDebt.paid_amount);
    mockDebt.status = mockDebt.remaining_amount === 0 ? 'paid' : (mockDebt.due_date < new Date().toISOString().split('T')[0] ? 'overdue' : 'pending');
    
    mockDebt.payments.push({
      id: Date.now(),
      debt_id: debtId,
      amount: payVal,
      paid_at: new Date().toISOString(),
      agent_id: agentId
    });

    return res.json({ success: true, message: 'Mock payment recorded successfully', remaining: mockDebt.remaining_amount });
  }
};
