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

      let record = await AgentInventory.findOne({
        where: { agent_id, product_id, date }
      });

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
          attributes: ['id', 'barcode', 'name', 'price', 'unit']
        }
      ]
    });

    res.json(inventory);
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
    await record.destroy();
    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
