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
    const { barcode, name, price, unit, stock } = req.body;
    
    const existing = await Product.findOne({ where: { barcode } });
    if (existing) {
      return res.status(400).json({ error: 'Product with this barcode already exists' });
    }

    const newProduct = await Product.create({ barcode, name, price, unit, stock });
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { barcode, name, price, unit, stock, is_active } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await product.update({ barcode, name, price, unit, stock, is_active });
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

    await product.update({ is_active: false });
    res.json({ message: 'Product deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
