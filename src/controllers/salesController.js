const { sequelize, Sale, SaleItem, Transaction, AgentInventory, Product, Store, TindaCallback, User } = require('../models');
const { sendTelegramNotification } = require('../utils/telegram');

exports.createSale = async (req, res) => {
  let t;
  let items = [];
  let total_amount = 0;
  let agent_id = req.user ? req.user.id : null;
  try {
    t = await sequelize.transaction();
    agent_id = req.user.id;
    const { store_id, payment_gateway } = req.body;
    const inputItems = req.body.items;

    if (!store_id || !inputItems || !Array.isArray(inputItems) || inputItems.length === 0) {
      return res.status(400).json({ error: 'Store ID and items are required' });
    }

    const store = await Store.findByPk(store_id, { transaction: t });
    if (!store) {
      await t.rollback();
      return res.status(404).json({ error: `Store with ID ${store_id} not found` });
    }
    const agent = await User.findByPk(agent_id, { transaction: t });
    if (!agent) {
      await t.rollback();
      return res.status(404).json({ error: `Agent with ID ${agent_id} not found` });
    }

    // Merge items with duplicate product_ids to prevent unique constraint conflicts
    const mergedMap = new Map();
    for (const item of inputItems) {
      const pid = parseInt(item.product_id);
      const qty = parseInt(item.quantity || item.qty || 1);
      const price = parseFloat(item.unit_price || 0);
      if (mergedMap.has(pid)) {
        const existing = mergedMap.get(pid);
        existing.quantity += qty;
        existing.unit_price = price;
      } else {
        mergedMap.set(pid, {
          product_id: pid,
          quantity: qty,
          unit_price: price
        });
      }
    }
    items = Array.from(mergedMap.values());

    const today = new Date().toISOString().split('T')[0];
    const todayDate = new Date(today);
    todayDate.setHours(0, 0, 0, 0);
    total_amount = 0;

    for (const item of items) {
      const { product_id, quantity } = item;

      const inventories = await AgentInventory.findAll({
        where: { agent_id, product_id },
        transaction: t
      });

      // Sort by date DESC to check the most recent assignment first
      const sortedInventories = [...inventories].sort((a, b) => new Date(b.date) - new Date(a.date));

      let inventory = sortedInventories.find(invItem => {
        const duration = invItem.duration_days;
        if (duration === 9999 || duration === 0) return true; // permanent

        const assignDate = new Date(invItem.date);
        assignDate.setHours(0, 0, 0, 0);

        const diffTime = todayDate.getTime() - assignDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return diffDays >= 0 && diffDays < (duration || 1);
      });

      if (!inventory) {
        // Auto-create agent inventory today if it doesn't exist to prevent blocking sales
        inventory = await AgentInventory.create({
          agent_id,
          product_id,
          date: today,
          qty_given: quantity,
          qty_sold: 0,
          duration_days: 1
        }, { transaction: t });
      } else {
        const availableQty = inventory.qty_given - inventory.qty_sold;
        if (availableQty < quantity) {
          // Auto-increase qty_given to prevent blocking sales
          await inventory.update({
            qty_given: inventory.qty_given + (quantity - availableQty)
          }, { transaction: t });
        }
      }

      const product = await Product.findByPk(product_id, { transaction: t });
      if (!product) {
        throw new Error(`Product ID ${product_id} not found`);
      }

      total_amount += parseFloat(item.unit_price) * quantity;
    }

    const sale = await Sale.create({
      agent_id,
      store_id,
      total_amount,
      status: 'pending'
    }, { transaction: t });

    for (const item of items) {
      const { product_id, quantity, unit_price } = item;
      const subtotal = parseFloat(unit_price) * quantity;

      await SaleItem.create({
        sale_id: sale.id,
        product_id,
        quantity,
        unit_price,
        subtotal
      }, { transaction: t });

      const inventories = await AgentInventory.findAll({
        where: { agent_id, product_id },
        transaction: t
      });

      // Sort by date DESC to check the most recent assignment first
      const sortedInventories = [...inventories].sort((a, b) => new Date(b.date) - new Date(a.date));

      const inventory = sortedInventories.find(invItem => {
        const duration = invItem.duration_days;
        if (duration === 9999 || duration === 0) return true; // permanent

        const assignDate = new Date(invItem.date);
        assignDate.setHours(0, 0, 0, 0);

        const diffTime = todayDate.getTime() - assignDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return diffDays >= 0 && diffDays < (duration || 1);
      });

      if (inventory) {
        await inventory.update({
          qty_sold: inventory.qty_sold + quantity
        }, { transaction: t });
      }
    }

    const transaction = await Transaction.create({
      sale_id: sale.id,
      payment_gateway: payment_gateway || 'click',
      status: 'pending',
      amount: total_amount
    }, { transaction: t });

    let debt = null;
    if (payment_gateway === 'nasiya') {
      const { Debt, DebtPayment } = require('../models');
      const todayStr = new Date().toISOString().split('T')[0];
      let dueDateVal = req.body.due_date;
      if (!dueDateVal) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        dueDateVal = d.toISOString().split('T')[0];
      }
      
      const initialPaymentVal = parseFloat(req.body.initial_payment || 0);
      const remainingVal = Math.max(0, total_amount - initialPaymentVal);
      const statusVal = remainingVal === 0 ? 'paid' : (dueDateVal < todayStr ? 'overdue' : 'pending');

      debt = await Debt.create({
        sale_id: sale.id,
        store_id: parseInt(store_id),
        agent_id: agent_id,
        total_amount: total_amount,
        paid_amount: initialPaymentVal,
        remaining_amount: remainingVal,
        due_date: dueDateVal,
        given_date: todayStr,
        status: statusVal,
        debtor_name: req.body.debtor_name || null,
        debtor_phone: req.body.debtor_phone || null
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

    await t.commit();

    // Clean up from TindaCallback (DB) and global.tindaUnassignedCallbacks if present
    try {
      const tindaSalesId = req.body.tinda_sales_id;
      const tindaReceiptNumber = req.body.tinda_receipt_number;

      // 1. Clean from DB
      const { Op } = require('sequelize');
      let dbMatch = null;
      
      if (tindaSalesId) {
        dbMatch = await TindaCallback.findOne({
          where: {
            [Op.or]: [
              { id: String(tindaSalesId) },
              { payload: { [Op.like]: `%${tindaSalesId}%` } }
            ]
          }
        });
      }
      
      if (!dbMatch && tindaReceiptNumber) {
        dbMatch = await TindaCallback.findOne({
          where: {
            payload: { [Op.like]: `%${tindaReceiptNumber}%` }
          }
        });
      }

      if (!dbMatch) {
        // Fallback match: same agent, same amount, and created within last 5 minutes
        const fiveMinsAgo = new Date(Date.now() - 300000);
        dbMatch = await TindaCallback.findOne({
          where: {
            agent_id: agent_id,
            amount: { [Op.between]: [parseFloat(total_amount) - 100, parseFloat(total_amount) + 100] },
            createdAt: { [Op.gte]: fiveMinsAgo }
          }
        });
      }

      if (dbMatch) {
        console.log(`salesController: Removing matched callback ${dbMatch.id} from DB.`);
        const matchedId = dbMatch.id;
        await dbMatch.destroy();

        // Also clean from global memory if present
        if (global.tindaUnassignedCallbacks && global.tindaUnassignedCallbacks.length > 0) {
          const matchIdx = global.tindaUnassignedCallbacks.findIndex(c => c.id === matchedId);
          if (matchIdx !== -1) {
            global.tindaUnassignedCallbacks.splice(matchIdx, 1);
          }
        }
      } else {
        // Fallback clean from global memory if DB search yielded nothing
        if (global.tindaUnassignedCallbacks && global.tindaUnassignedCallbacks.length > 0) {
          const matchIndex = global.tindaUnassignedCallbacks.findIndex(c => {
            if (tindaSalesId && c.payload && (c.payload.id === tindaSalesId || c.payload.sales_id === tindaSalesId || c.payload.salePublicId === tindaSalesId)) return true;
            if (tindaReceiptNumber && c.payload && (c.payload.receipt_number === tindaReceiptNumber || c.payload.receiptNumber === tindaReceiptNumber)) return true;
            if (c.agentId === agent_id && Math.abs(parseFloat(c.amount) - parseFloat(total_amount)) < 100 && (Date.now() - c.timestamp) < 300000) return true;
            return false;
          });
          if (matchIndex !== -1) {
            console.log(`salesController: Removing matched callback ${global.tindaUnassignedCallbacks[matchIndex].id} from unassigned memory queue.`);
            global.tindaUnassignedCallbacks.splice(matchIndex, 1);
          }
        }
      }
    } catch (cleanErr) {
      console.warn("salesController: Failed to clean up from TindaCallback (DB/Memory):", cleanErr.message);
    }

    // Trigger Telegram notification in the background
    (async () => {
      try {
        const { User } = require('../models');
        const agent = await User.findByPk(agent_id);
        const store = await Store.findByPk(store_id);

        let itemsListHtml = '';
        for (const item of items) {
          const product = await Product.findByPk(item.product_id);
          const productName = product ? product.name : `Mahsulot (ID: ${item.product_id})`;
          const productUnit = product ? (product.unit || 'dona') : 'dona';
          const qty = item.quantity;
          const price = parseFloat(item.unit_price).toLocaleString('uz-UZ');
          const subtotal = (parseFloat(item.unit_price) * qty).toLocaleString('uz-UZ');
          itemsListHtml += `• <b>${productName}</b>: ${qty} ${productUnit} x ${price} so'm = <b>${subtotal} so'm</b>\n`;
        }

        const agentName = agent ? (agent.name || agent.username) : 'Noma\'lum Agent';
        const agentPhone = agent ? (agent.phone || '-') : '-';
        const storeName = store ? store.name : 'Noma\'lum Do\'kon';
        const storeAddress = store ? (store.address || '-') : '-';
        const totalSum = parseFloat(total_amount).toLocaleString('uz-UZ');
        const payMethod = (payment_gateway || 'click').toUpperCase();

        const telegramMessage = 
`🔔 <b>YANGI SAVDO RO'YXATDAN O'TKAZILDI!</b>

👤 <b>Agent:</b> ${agentName} (${agentPhone})
🏪 <b>Do'kon:</b> ${storeName}
📍 <b>Manzil:</b> ${storeAddress}

💰 <b>Umumiy summa:</b> <b>${totalSum} so'm</b>
💳 <b>To'lov turi:</b> ${payMethod}

📦 <b>Sotilgan mahsulotlar:</b>
${itemsListHtml}
📅 <i>Sana: ${new Date().toLocaleString('uz-UZ')}</i>`;

        await sendTelegramNotification(telegramMessage);
      } catch (err) {
        console.error('Telegram notification prep failed:', err);
      }
    })();

    res.status(201).json({
      message: 'Sale created successfully. Awaiting payment.',
      sale,
      transaction
    });
  } catch (error) {
    if (t) await t.rollback();
    console.error("DB createSale transaction failed:", error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.getAgentSales = async (req, res) => {
  try {
    const { agentId } = req.params;
    const sales = await Sale.findAll({
      where: { agent_id: agentId },
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['name', 'address']
        },
        {
          model: Transaction,
          as: 'transaction',
          attributes: ['payment_gateway', 'status', 'amount']
        },
        {
          model: SaleItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['barcode', 'name', 'unit', 'price', 'original_price']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSaleDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findByPk(id, {
      include: [
        {
          model: Store,
          as: 'store'
        },
        {
          model: SaleItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['barcode', 'name', 'unit']
            }
          ]
        },
        {
          model: Transaction,
          as: 'transaction'
        }
      ]
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllSales = async (req, res) => {
  try {
    const { User } = require('../models'); // import User dynamically to prevent circular dependencies if any
    const sales = await Sale.findAll({
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['name', 'address']
        },
        {
          model: User,
          as: 'agent',
          attributes: ['name', 'username', 'phone']
        },
        {
          model: SaleItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['barcode', 'name', 'unit', 'price', 'original_price']
            }
          ]
        },
        {
          model: Transaction,
          as: 'transaction',
          attributes: ['payment_gateway', 'status', 'amount']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
