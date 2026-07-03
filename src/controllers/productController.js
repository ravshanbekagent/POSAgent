const { Product } = require('../models');

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.findAll({ where: { is_active: true } });
    res.json(products);
  } catch (error) {
    console.warn("DB getProducts query failed, falling back to mock products.");
    const mockProducts = [
      { id: 1, barcode: '48200001', name: 'IQOS Iluma One (Pebble Grey)', price: 350000, original_price: 300000, unit: 'dona', stock: 150, is_active: true },
      { id: 2, barcode: '48200002', name: 'Heets Amber Selection', price: 18000, original_price: 15000, unit: 'blok', stock: 1200, is_active: true },
      { id: 3, barcode: '48200003', name: 'IQOS Terea Silver', price: 22000, original_price: 19000, unit: 'blok', stock: 800, is_active: true },
      { id: 4, barcode: '48200004', name: 'Fiit Regular', price: 17000, original_price: 14000, unit: 'blok', stock: 650, is_active: true }
    ];
    res.json(mockProducts);
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { 
      barcode, name, price, original_price, unit, stock,
      category, psid, marked, is_integer_units, package_code,
      inn, pinfl, owner_type, store_name, vat, unit_code
    } = req.body;
    
    if (original_price && parseFloat(price) < parseFloat(original_price)) {
      return res.status(400).json({ error: 'Sotish narxi asl narxidan (tannarxidan) kam bo\'lishi mumkin emas! Zarariga sotish taqiqlangan.' });
    }

    const existing = await Product.findOne({ where: { barcode } });
    if (existing) {
      if (!existing.is_active) {
        await existing.update({
          name,
          price,
          original_price: original_price || 0,
          unit: unit || 'dona',
          stock: stock || 0,
          is_active: true,
          category,
          psid,
          marked,
          is_integer_units,
          package_code,
          inn,
          pinfl,
          owner_type,
          store_name,
          vat,
          unit_code
        });
        return res.status(201).json(existing);
      }
      return res.status(400).json({ error: 'Product with this barcode already exists' });
    }

    const newProduct = await Product.create({ 
      barcode, name, price, original_price, unit, stock,
      category, psid, marked, is_integer_units, package_code,
      inn, pinfl, owner_type, store_name, vat, unit_code
    });
    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Create Product Error:", error);
    if (error.errors && Array.isArray(error.errors)) {
      const messages = error.errors.map(err => `${err.path}: ${err.message}`).join(', ');
      return res.status(500).json({ error: `Validation error - ${messages}` });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      barcode, name, price, original_price, unit, stock, is_active,
      category, psid, marked, is_integer_units, package_code,
      inn, pinfl, owner_type, store_name, vat, unit_code
    } = req.body;

    if (original_price && parseFloat(price) < parseFloat(original_price)) {
      return res.status(400).json({ error: 'Sotish narxi asl narxidan (tannarxidan) kam bo\'lishi mumkin emas! Zarariga sotish taqiqlangan.' });
    }

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await product.update({ 
      barcode, name, price, original_price, unit, stock, is_active,
      category, psid, marked, is_integer_units, package_code,
      inn, pinfl, owner_type, store_name, vat, unit_code
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await product.destroy();
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
