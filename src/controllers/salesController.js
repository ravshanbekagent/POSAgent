const { sequelize, Sale, SaleItem, Transaction, AgentInventory, Product, Store } = require('../models');

exports.createSale = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const agent_id = req.user.id;
    const { store_id, items, payment_gateway } = req.body;

    if (!store_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Store ID and items are required' });
    }

    const today = new Date().toISOString().split('T')[0];
    let total_amount = 0;

    for (const item of items) {
      const { product_id, quantity } = item;

      const inventory = await AgentInventory.findOne({
        where: { agent_id, product_id, date: today }
      });

      if (!inventory) {
        throw new Error(`Inventory record not found for product ID ${product_id} today`);
      }

      const availableQty = inventory.qty_given - inventory.qty_sold;
      if (availableQty < quantity) {
        throw new Error(`Insufficient inventory for product ID ${product_id}. Available: ${availableQty}, Requested: ${quantity}`);
      }

      const product = await Product.findByPk(product_id);
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

      const inventory = await AgentInventory.findOne({
        where: { agent_id, product_id, date: today }
      });

      await inventory.update({
        qty_sold: inventory.qty_sold + quantity
      }, { transaction: t });
    }

    const transaction = await Transaction.create({
      sale_id: sale.id,
      payment_gateway: payment_gateway || 'click',
      status: 'pending',
      amount: total_amount
    }, { transaction: t });

    await t.commit();

    res.status(201).json({
      message: 'Sale created successfully. Awaiting payment.',
      sale,
      transaction
    });
  } catch (error) {
    await t.rollback();
    res.status(400).json({ error: error.message });
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
