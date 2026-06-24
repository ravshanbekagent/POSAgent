const { sequelize, Product } = require('./src/models');

async function test() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Try to create a test product
    const testProduct = await Product.create({
      barcode: '121345_test_' + Date.now(),
      name: 'Diagnostic Test Product',
      price: 10000.00,
      original_price: 15000.00,
      unit: 'dona',
      stock: 100
    });
    
    console.log('Product created successfully locally:', testProduct.toJSON());
  } catch (error) {
    console.error('ERROR ENCOUNTERED:');
    console.error('Message:', error.message);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error(`- Field: ${err.path}, Value: ${err.value}, Type: ${err.type}, Message: ${err.message}`);
      });
    } else {
      console.error(error);
    }
  } finally {
    await sequelize.close();
  }
}

test();
