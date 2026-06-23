const { Store } = require('../models');

exports.getStores = async (req, res) => {
  try {
    const stores = await Store.findAll();
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createStore = async (req, res) => {
  try {
    const { name, owner_name, phone, address, map_link, location_lat, location_lng } = req.body;
    const newStore = await Store.create({
      name,
      owner_name,
      phone,
      address,
      map_link,
      location_lat,
      location_lng
    });
    res.status(201).json(newStore);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, owner_name, phone, address, map_link, location_lat, location_lng } = req.body;

    const store = await Store.findByPk(id);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    await store.update({
      name,
      owner_name,
      phone,
      address,
      map_link,
      location_lat,
      location_lng
    });
    res.json(store);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
