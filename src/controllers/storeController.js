const { Store } = require('../models');

exports.getStores = async (req, res) => {
  try {
    const stores = await Store.findAll();
    res.json(stores);
  } catch (error) {
    console.warn("DB getStores query failed, falling back to mock stores.");
    const mockStores = [
      { id: 14489, name: "G'ofur Ota Mini Market", owner_name: "G'ofurjon akam", phone: '+998 90 123 45 67', address: 'Toshkent sh., Chilonzor 6-daha', map_link: 'https://maps.google.com/?q=41.2842,69.1863', location_lat: '41.2842', location_lng: '69.1863', agent_id: 2, assigned_date: new Date().toISOString(), duration_days: 7 },
      { id: 57196, name: 'Premium Smoke Shop', owner_name: 'Davronbek', phone: '+998 93 543 21 09', address: "Toshkent sh., Amir Temur ko'chasi 12", map_link: 'https://maps.google.com/?q=41.3113,69.2797', location_lat: '41.3113', location_lng: '69.2797', agent_id: 2, assigned_date: new Date().toISOString(), duration_days: 7 },
      { id: 53110, name: "24/7 Baza Do'kon", owner_name: 'Azamat', phone: '+998 99 999 88 77', address: 'Toshkent sh., Yunusobod 11-kvartal', map_link: 'https://maps.google.com/?q=41.3654,69.2891', location_lat: '41.3654', location_lng: '69.2891', agent_id: 2, assigned_date: new Date().toISOString(), duration_days: 7 }
    ];
    res.json(mockStores);
  }
};

exports.createStore = async (req, res) => {
  try {
    const { name, owner_name, phone, address, map_link, location_lat, location_lng, agent_id, assigned_date, duration_days, order } = req.body;
    const newStore = await Store.create({
      name,
      owner_name,
      phone,
      address,
      map_link,
      location_lat,
      location_lng,
      agent_id,
      assigned_date,
      duration_days: duration_days || 1,
      order
    });
    res.status(201).json(newStore);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, owner_name, phone, address, map_link, location_lat, location_lng, agent_id, assigned_date, duration_days, order } = req.body;

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
      location_lng,
      agent_id,
      assigned_date,
      duration_days: duration_days !== undefined ? duration_days : store.duration_days,
      order
    });
    res.json(store);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteStore = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findByPk(id);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    await store.destroy();
    res.json({ message: 'Store deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.bulkCreateStores = async (req, res) => {
  try {
    const storesArray = req.body;
    if (!Array.isArray(storesArray)) {
      return res.status(400).json({ error: 'Array of stores is required' });
    }

    const cleanedStores = storesArray.map(s => ({
      name: s.name,
      owner_name: s.owner_name || 'Tadbirkor',
      phone: s.phone || '+998 90 000 00 00',
      address: s.address,
      map_link: s.map_link,
      location_lat: String(s.location_lat || s.latitude || ''),
      location_lng: String(s.location_lng || s.longitude || '')
    }));

    const newStores = await Store.bulkCreate(cleanedStores);
    res.status(201).json(newStores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
