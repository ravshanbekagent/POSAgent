const { StoreVisit, Store, User } = require('../models');

exports.createVisit = async (req, res) => {
  try {
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

    const newVisit = await StoreVisit.create({
      agent_id,
      store_id,
      status,
      reason,
      items: typeof items === 'object' ? JSON.stringify(items) : items,
      date,
      time
    });

    res.status(201).json(newVisit);
  } catch (error) {
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
