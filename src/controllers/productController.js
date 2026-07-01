const { Product } = require('../models');

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.findAll({ where: { is_active: true } });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { barcode, name, price, original_price, unit, stock } = req.body;
    
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
          is_active: true
        });
        return res.status(201).json(existing);
      }
      return res.status(400).json({ error: 'Product with this barcode already exists' });
    }

    const newProduct = await Product.create({ barcode, name, price, original_price, unit, stock });
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
    const { barcode, name, price, original_price, unit, stock, is_active } = req.body;

    if (original_price && parseFloat(price) < parseFloat(original_price)) {
      return res.status(400).json({ error: 'Sotish narxi asl narxidan (tannarxidan) kam bo\'lishi mumkin emas! Zarariga sotish taqiqlangan.' });
    }

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await product.update({ barcode, name, price, original_price, unit, stock, is_active });
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
