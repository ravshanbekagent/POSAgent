const { AgentInventory, Product } = require('../models');

exports.assignInventory = async (req, res) => {
  try {
    const { agent_id, date, products } = req.body; // products: [{ product_id, qty_given }]

    if (!agent_id || !date || !products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Missing required fields or products format is invalid' });
    }

    const createdRecords = [];

    for (const item of products) {
      const { product_id, qty_given } = item;

      const product = await Product.findByPk(product_id);
      if (!product) {
        return res.status(404).json({ error: `Product with ID ${product_id} not found` });
      }

      let record = await AgentInventory.findOne({
        where: { agent_id, product_id, date }
      });

      const oldQty = record ? record.qty_given : 0;
      const qtyDiff = qty_given - oldQty;

      if (qtyDiff > 0 && product.stock < qtyDiff) {
        return res.status(400).json({ 
          error: `Omborda ${product.name} mahsulotidan yetarli qoldiq yo'q! Hozirgi qoldiq: ${product.stock}` 
        });
      }

      // Deduct from product stock
      await product.update({ stock: product.stock - qtyDiff });

      if (record) {
        await record.update({ qty_given });
      } else {
        record = await AgentInventory.create({
          agent_id,
          product_id,
          qty_given,
          date
        });
      }
      createdRecords.push(record);
    }

    res.status(200).json({ message: 'Inventory assigned successfully', records: createdRecords });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAgentInventory = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { date } = req.query;

    const searchDate = date || new Date().toISOString().split('T')[0];

    const inventory = await AgentInventory.findAll({
      where: { agent_id: agentId, date: searchDate },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'barcode', 'name', 'price', 'unit', 'stock']
        }
      ]
    });

    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { qty_given } = req.body;

    const record = await AgentInventory.findByPk(id);
    if (!record) {
      return res.status(404).json({ error: 'Assignment record not found' });
    }

    const product = await Product.findByPk(record.product_id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const qtyDiff = qty_given - record.qty_given;

    // If we are increasing the assignment, check if enough stock is in warehouse
    if (qtyDiff > 0 && product.stock < qtyDiff) {
      return res.status(400).json({ 
        error: `Omborda ${product.name} mahsulotidan yetarli qoldiq yo'q! Hozirgi qoldiq: ${product.stock}` 
      });
    }

    // Update product stock in warehouse
    await product.update({ stock: product.stock - qtyDiff });

    // Update assignment record
    await record.update({ qty_given });

    res.json({ message: 'Assignment updated successfully', record });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await AgentInventory.findByPk(id);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    // Return remaining stock to warehouse
    const remainingQty = record.qty_given - record.qty_sold - record.qty_returned;
    if (remainingQty > 0) {
      const product = await Product.findByPk(record.product_id);
      if (product) {
        await product.update({ stock: product.stock + remainingQty });
      }
    }

    await record.destroy();
    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
