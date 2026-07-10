const { StoreVisit, Store, User } = require('../models');

exports.createVisit = async (req, res) => {
  const { store_id, status, reason, items, date, time } = req.body;
  const agent_id = req.user.id; // Extract from authenticated user token

  // Check for existing duplicate visit to prevent double inserts
  const existingVisit = await StoreVisit.findOne({
    where: {
      agent_id,
      store_id,
      status,
      date,
      time
    }
  });

  if (existingVisit) {
    console.log(`visitController: Duplicate visit detected, returning existing visit ID: ${existingVisit.id}`);
    return res.status(200).json(existingVisit);
  }

  const { Sale, SaleItem, Product, Transaction, Debt, DebtPayment, sequelize } = require('../models');
  const t = await sequelize.transaction();

  try {
    // 1. Create the visit record
    const newVisit = await StoreVisit.create({
      agent_id,
      store_id,
      status,
      reason,
      items: typeof items === 'object' ? JSON.stringify(items) : items,
      date,
      time
    }, { transaction: t });

    // 2. If the visit is a sale, also record the sale and potential debt online in DB
    if (status === 'sold' && items) {
      const parsed = typeof items === 'string' ? JSON.parse(items) : items;
      const products = parsed.products || [];
      const paymentMethod = (parsed.paymentMethod || 'naqd').toLowerCase();
      const initialPaymentVal = parseFloat(parsed.initialPayment || 0);

      if (products.length > 0) {
        // Calculate total amount
        let total_amount = 0;
        const saleItemsToCreate = [];

        for (const item of products) {
          const qty = parseInt(item.qty || item.quantity || 1);
          const price = parseFloat(item.price || item.unit_price || 0);
          const prodId = parseInt(item.productId || item.product_id || item.id);
          
          total_amount += qty * price;

          // Update inventory stock
          const product = await Product.findByPk(prodId, { transaction: t });
          if (product) {
            const originalPrice = parseFloat(product.original_price || 0);
            saleItemsToCreate.push({
              product_id: prodId,
              quantity: qty,
              unit_price: price,
              original_price: originalPrice
            });

            await product.update({
              stock: Math.max(0, product.stock - qty)
            }, { transaction: t });
          }
        }

        // Create the Sale
        const sale = await Sale.create({
          store_id: parseInt(store_id),
          agent_id: agent_id,
          total_amount: total_amount,
          status: 'completed'
        }, { transaction: t });

        // Create SaleItems
        for (const saleItem of saleItemsToCreate) {
          await SaleItem.create({
            sale_id: sale.id,
            ...saleItem
          }, { transaction: t });
        }

        // Create Transaction
        await Transaction.create({
          sale_id: sale.id,
          payment_gateway: paymentMethod,
          status: 'completed',
          amount: total_amount
        }, { transaction: t });

        // If payment method is debt (nasiya), create the Debt record online!
        if (paymentMethod === 'nasiya') {
          const todayStr = new Date().toISOString().split('T')[0];
          
          // Calculate due date
          const dueDays = parseInt(parsed.dueDays || 30);
          const d = new Date();
          d.setDate(d.getDate() + dueDays);
          const dueDateVal = d.toISOString().split('T')[0];
          
          const remainingVal = Math.max(0, total_amount - initialPaymentVal);
          const statusVal = remainingVal === 0 ? 'paid' : (dueDateVal < todayStr ? 'overdue' : 'pending');

          const debt = await Debt.create({
            sale_id: sale.id,
            store_id: parseInt(store_id),
            agent_id: agent_id,
            total_amount: total_amount,
            paid_amount: initialPaymentVal,
            remaining_amount: remainingVal,
            due_date: dueDateVal,
            given_date: todayStr,
            status: statusVal,
            debtor_name: parsed.debtorName || null,
            debtor_phone: parsed.debtorPhone || null
          }, { transaction: t });

          if (initialPaymentVal > 0) {
            await DebtPayment.create({
              debt_id: debt.id,
              amount: initialPaymentVal,
              agent_id: agent_id,
              payment_method: 'naqd',
              paid_at: new Date().toISOString()
            }, { transaction: t });
          }
        }
      }
    }

    await t.commit();
    res.status(201).json(newVisit);
  } catch (error) {
    await t.rollback();
    console.error("visitController error during transaction:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getVisits = async (req, res) => {
  try {
    const visits = await StoreVisit.findAll({
      include: [
        { model: Store, as: 'store', attributes: ['name'] },
        { model: User, as: 'agent', attributes: ['name', 'username'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(visits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAgentVisits = async (req, res) => {
  try {
    const { agentId } = req.params;
    const visits = await StoreVisit.findAll({
      where: { agent_id: agentId },
      include: [
        { model: Store, as: 'store', attributes: ['name'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(visits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
