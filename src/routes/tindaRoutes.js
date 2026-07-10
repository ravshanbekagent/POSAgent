const express = require('express');
const router = express.Router();
const { TindaCallback } = require('../models');

// In-memory storage for active callbacks
// Structure: { [serialNumber]: { payload, timestamp } }
if (!global.tindaCallbacks) {
  global.tindaCallbacks = {};
}

// Queue for pending unassigned payments
if (!global.tindaUnassignedCallbacks) {
  global.tindaUnassignedCallbacks = [];
}

// Webhook log history for debugging
if (!global.tindaWebhookLogs) {
  global.tindaWebhookLogs = [];
}

// Middleware to parse text/plain string bodies as JSON if applicable
router.use((req, res, next) => {
  if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      console.warn('tindaRoutes: Failed to parse plain text body as JSON:', e.message);
    }
  }
  next();
});

// Helper to look up agent ID by terminal serial number
async function getAgentIdBySerialNumber(serialNumber) {
  try {
    const { User } = require('../models');
    const user = await User.findOne({ where: { terminal_sn: serialNumber } });
    if (user) return user.id;
  } catch (err) {
    console.warn("DB user lookup failed in tindaRoutes, using fallback.");
  }
  
  // Mock fallback
  if (global.mockTerminalMappings) {
    const key = Object.keys(global.mockTerminalMappings).find(
      k => global.mockTerminalMappings[k] === serialNumber
    );
    if (key) return parseInt(key);
  }
  return null;
}

// 1. Tinda Webhook Endpoint (Receives callback from Tinda/ERA)
router.post('/callback', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Received Tinda Webhook Callback:', JSON.stringify(payload, null, 2));

    // Log to webhook debug history
    if (global.tindaWebhookLogs) {
      global.tindaWebhookLogs.unshift({
        endpoint: '/callback',
        timestamp: new Date().toISOString(),
        method: req.method,
        headers: req.headers,
        query: req.query,
        body: req.body || null
      });
      if (global.tindaWebhookLogs.length > 50) {
        global.tindaWebhookLogs.pop();
      }
    }

    // Try to find the serial number in standard fields
    const serialNumber = payload.serial_number || 
                         payload.serialNumber || 
                         (payload.pos && payload.pos.posHardwareSerialNumber) ||
                         (payload.payload && (payload.payload.serial_number || payload.payload.serialNumber || (payload.payload.pos && payload.payload.pos.posHardwareSerialNumber)));

    if (!serialNumber) {
      console.warn('Tinda callback received, but no serial number found in body.');
      return res.status(400).json({ success: false, error: 'serialNumber is required' });
    }

    // Normalize properties for frontend and database compatibility
    if (!payload.serial_number && serialNumber) {
      payload.serial_number = serialNumber;
    }
    // Normalize products list for frontend and database compatibility
    const rawProducts = payload.productList || payload.products || [];
    payload.products = rawProducts.map(p => ({
      productId: (p.product && p.product.id) || p.productId || p.id,
      productName: p.productName || (p.product && p.product.name) || 'Mahsulot',
      price: parseFloat(p.price || 0),
      quantity: parseInt(p.amount || p.quantity || p.qty || p.count || 1),
      barcode: (p.barcodes && p.barcodes[0]) || (p.product && p.product.barcodes && p.product.barcodes[0]) || p.barcode || ''
    }));
    if (!payload.total_amount) {
      payload.total_amount = parseFloat(payload.amount || (payload.payment && payload.payment.amount) || 0);
    }

    // Store in global memory for active polling
    global.tindaCallbacks[serialNumber] = {
      payload: payload,
      timestamp: Date.now()
    };

    console.log(`Stored callback for Terminal Serial Number: ${serialNumber}`);

    // Add to unassigned payments queue
    const agentId = await getAgentIdBySerialNumber(serialNumber);
    if (agentId) {
      const transId = payload.id || payload.salePublicId || payload.sales_id || payload.receipt_number || payload.receiptNumber || `PEND-${Date.now()}`;
      
      const { Op } = require('sequelize');
      const exists = await TindaCallback.findOne({
        where: {
          [Op.or]: [
            { id: String(transId) },
            { payload: { [Op.like]: `%${transId}%` } }
          ]
        }
      });

      if (!exists) {
        const callbackId = `PEND-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await TindaCallback.create({
          id: callbackId,
          agent_id: agentId,
          serial_number: serialNumber,
          amount: payload.total_amount,
          products: JSON.stringify(payload.products || []),
          status: 'pending',
          payload: JSON.stringify(payload)
        });
        console.log(`Unassigned payment saved to DB for Agent ID: ${agentId}, Callback ID: ${callbackId}`);
      }
    }

    return res.json({ success: true, message: 'Callback registered successfully' });
  } catch (error) {
    console.error('Error handling Tinda callback:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Poll Endpoint (Frontend checks if a callback has arrived for a serial number)
router.get('/callback/:serialNumber', (req, res) => {
  try {
    const { serialNumber } = req.params;
    const callbackData = global.tindaCallbacks[serialNumber];

    if (!callbackData) {
      return res.json({ found: false });
    }

    // Check if the callback is older than 3 minutes (180,000ms) to prevent stale data
    const age = Date.now() - callbackData.timestamp;
    if (age > 180000) {
      delete global.tindaCallbacks[serialNumber];
      return res.json({ found: false, message: 'Callback expired' });
    }

    // Return and remove from memory so it's only consumed once
    delete global.tindaCallbacks[serialNumber];

    console.log(`Callback consumed and cleared for Serial Number: ${serialNumber}`);
    return res.json({ found: true, callback: callbackData.payload });
  } catch (error) {
    console.error('Error polling Tinda callback:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Mock Webhook Endpoint (For local testing/simulation)
router.post('/mock-callback', (req, res) => {
  try {
    const { serialNumber, products, totalAmount } = req.body;

    if (!serialNumber) {
      return res.status(400).json({ success: false, error: 'serialNumber is required' });
    }

    const finalProducts = products || [
      {
        productId: 1, // matches our seeded product IQOS Iluma One
        productName: 'IQOS Iluma One (Pebble Grey)',
        price: 350000,
        quantity: 2
      },
      {
        productId: 2, // matches Heets Amber Selection
        productName: 'Heets Amber Selection',
        price: 18000,
        quantity: 50
      }
    ];

    const computedTotal = finalProducts.reduce((sum, p) => sum + (parseFloat(p.price || 0) * parseInt(p.quantity || 1)), 0);
    const finalTotalAmount = totalAmount || computedTotal || 1600000;

    // Create a mock payload resembling Tinda's structure
    const mockPayload = {
      sales_id: `MOCK-${Date.now()}`,
      receipt_number: Math.floor(Math.random() * 1000) + 1,
      date: new Date().toISOString(),
      serial_number: serialNumber,
      total_amount: finalTotalAmount,
      payment: {
        payment_method: 'by other cashless',
        amount: finalTotalAmount
      },
      products: finalProducts
    };

    global.tindaCallbacks[serialNumber] = {
      payload: mockPayload,
      timestamp: Date.now()
    };

    console.log(`Mock callback registered for Serial Number: ${serialNumber}`);
    return res.json({ success: true, message: 'Mock callback registered', payload: mockPayload });
  } catch (error) {
    console.error('Error creating mock callback:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// In-memory storage for refund and z-report callbacks
if (!global.tindaRefunds) {
  global.tindaRefunds = {};
}
if (!global.tindaZReports) {
  global.tindaZReports = {};
}

// 4. Tinda Refund Webhook Endpoint
router.post('/refund', (req, res) => {
  try {
    const payload = req.body;
    console.log('Received Tinda Webhook Refund:', JSON.stringify(payload, null, 2));

    const serialNumber = payload.serial_number || 
                         payload.serialNumber || 
                         (payload.pos && payload.pos.posHardwareSerialNumber) ||
                         (payload.payload && (payload.payload.serial_number || payload.payload.serialNumber || (payload.payload.pos && payload.payload.pos.posHardwareSerialNumber)));

    if (!serialNumber) {
      console.warn('Tinda refund received, but no serial number found.');
      return res.status(400).json({ success: false, error: 'serialNumber is required' });
    }

    global.tindaRefunds[serialNumber] = {
      payload: payload,
      timestamp: Date.now()
    };

    console.log(`Stored refund callback for Serial Number: ${serialNumber}`);
    return res.json({ success: true, message: 'Refund callback registered successfully' });
  } catch (error) {
    console.error('Error handling Tinda refund:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Poll Endpoint for Refund
router.get('/refund/:serialNumber', (req, res) => {
  try {
    const { serialNumber } = req.params;
    const refundData = global.tindaRefunds[serialNumber];

    if (!refundData) {
      return res.json({ found: false });
    }

    const age = Date.now() - refundData.timestamp;
    if (age > 180000) {
      delete global.tindaRefunds[serialNumber];
      return res.json({ found: false, message: 'Refund callback expired' });
    }

    delete global.tindaRefunds[serialNumber];
    console.log(`Refund callback consumed and cleared for Serial Number: ${serialNumber}`);
    return res.json({ found: true, callback: refundData.payload });
  } catch (error) {
    console.error('Error polling Tinda refund:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Tinda Z-Report Webhook Endpoint
router.post('/zreport', (req, res) => {
  try {
    const payload = req.body;
    console.log('Received Tinda Webhook Z-Report:', JSON.stringify(payload, null, 2));

    const serialNumber = payload.serial_number || 
                         payload.serialNumber || 
                         (payload.pos && payload.pos.posHardwareSerialNumber) ||
                         (payload.payload && (payload.payload.serial_number || payload.payload.serialNumber || (payload.payload.pos && payload.payload.pos.posHardwareSerialNumber)));

    if (!serialNumber) {
      console.warn('Tinda Z-Report received, but no serial number found.');
      return res.status(400).json({ success: false, error: 'serialNumber is required' });
    }

    global.tindaZReports[serialNumber] = {
      payload: payload,
      timestamp: Date.now()
    };

    console.log(`Stored Z-Report callback for Serial Number: ${serialNumber}`);
    return res.json({ success: true, message: 'Z-Report callback registered successfully' });
  } catch (error) {
    console.error('Error handling Tinda Z-Report:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Poll Endpoint for Z-Report
router.get('/zreport/:serialNumber', (req, res) => {
  try {
    const { serialNumber } = req.params;
    const zReportData = global.tindaZReports[serialNumber];

    if (!zReportData) {
      return res.json({ found: false });
    }

    const age = Date.now() - zReportData.timestamp;
    if (age > 180000) {
      delete global.tindaZReports[serialNumber];
      return res.json({ found: false, message: 'Z-Report callback expired' });
    }

    delete global.tindaZReports[serialNumber];
    console.log(`Z-Report callback consumed and cleared for Serial Number: ${serialNumber}`);
    return res.json({ found: true, callback: zReportData.payload });
  } catch (error) {
    console.error('Error polling Tinda Z-Report:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Mock Webhook Endpoint for Refund (For local testing/simulation)
router.post('/mock-refund', (req, res) => {
  try {
    const { serialNumber, products, totalAmount } = req.body;

    if (!serialNumber) {
      return res.status(400).json({ success: false, error: 'serialNumber is required' });
    }

    const mockPayload = {
      refund_id: `MOCK-REF-${Date.now()}`,
      receipt_number: Math.floor(Math.random() * 1000) + 1,
      date: new Date().toISOString(),
      serial_number: serialNumber,
      total_amount: totalAmount || 350000,
      products: products || [
        {
          productId: 1,
          productName: 'IQOS Iluma One (Pebble Grey)',
          price: 350000,
          quantity: 1
        }
      ]
    };

    global.tindaRefunds[serialNumber] = {
      payload: mockPayload,
      timestamp: Date.now()
    };

    console.log(`Mock refund callback registered for Serial Number: ${serialNumber}`);
    return res.json({ success: true, message: 'Mock refund registered', payload: mockPayload });
  } catch (error) {
    console.error('Error creating mock refund:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Mock Webhook Endpoint for Z-Report (For local testing/simulation)
router.post('/mock-zreport', (req, res) => {
  try {
    const { serialNumber } = req.body;

    if (!serialNumber) {
      return res.status(400).json({ success: false, error: 'serialNumber is required' });
    }

    const mockPayload = {
      zreport_id: `MOCK-Z-${Date.now()}`,
      date: new Date().toISOString(),
      serial_number: serialNumber,
      total_sales: 15400000,
      cash_amount: 5400000,
      card_amount: 10000000,
      transactions_count: 42
    };

    global.tindaZReports[serialNumber] = {
      payload: mockPayload,
      timestamp: Date.now()
    };

    console.log(`Mock Z-Report callback registered for Serial Number: ${serialNumber}`);
    return res.json({ success: true, message: 'Mock Z-Report registered', payload: mockPayload });
  } catch (error) {
    console.error('Error creating mock Z-Report:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 10. GET /pending-payments/:agentId (Get unassigned terminal payments for an agent)
router.get('/pending-payments/:agentId', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const callbacks = await TindaCallback.findAll({
      where: {
        agent_id: agentId,
        status: 'pending'
      }
    });

    const pending = callbacks.map(c => {
      let parsedProducts = [];
      let parsedPayload = {};
      try { parsedProducts = JSON.parse(c.products || '[]'); } catch(e) {}
      try { parsedPayload = JSON.parse(c.payload || '{}'); } catch(e) {}

      return {
        id: c.id,
        agentId: c.agent_id,
        serialNumber: c.serial_number,
        amount: parseFloat(c.amount),
        products: parsedProducts,
        status: c.status,
        payload: parsedPayload,
        createdAt: c.createdAt
      };
    });

    return res.json(pending);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 11. POST /assign-payment (Bind pending payment to a store and record the sale)
router.post('/assign-payment', async (req, res) => {
  try {
    const { paymentId, storeId } = req.body;
    if (!paymentId || !storeId) {
      return res.status(400).json({ error: 'paymentId and storeId are required' });
    }

    const dbCallback = await TindaCallback.findByPk(paymentId);
    let payment = null;

    if (dbCallback) {
      let parsedProducts = [];
      let parsedPayload = {};
      try { parsedProducts = JSON.parse(dbCallback.products || '[]'); } catch(e) {}
      try { parsedPayload = JSON.parse(dbCallback.payload || '{}'); } catch(e) {}
      payment = {
        id: dbCallback.id,
        agentId: dbCallback.agent_id,
        serialNumber: dbCallback.serial_number,
        amount: parseFloat(dbCallback.amount),
        products: parsedProducts,
        status: dbCallback.status,
        payload: parsedPayload
      };
    } else {
      const fallbackIndex = (global.tindaUnassignedCallbacks || []).findIndex(
        c => c.id === paymentId
      );
      if (fallbackIndex === -1) {
        return res.status(404).json({ error: 'Pending payment not found' });
      }
      payment = global.tindaUnassignedCallbacks[fallbackIndex];
    }

    try {
      const { Sale, SaleItem, Transaction, StoreVisit } = require('../models');

      // Create Sale in DB
      const newSale = await Sale.create({
        agent_id: payment.agentId,
        store_id: parseInt(storeId),
        total_amount: payment.amount,
        status: 'completed'
      });

      // Create Sale Items if products exist
      if (payment.products && payment.products.length > 0) {
        const { Product } = require('../models');
        for (const prod of payment.products) {
          const barcode = prod.barcode || '';
          const name = prod.productName || '';

          let localProduct = null;
          if (barcode) {
            localProduct = await Product.findOne({ where: { barcode } });
          }
          if (!localProduct && name) {
            localProduct = await Product.findOne({ where: { name } });
          }

          const resolvedProductId = localProduct ? localProduct.id : 1;
          const resolvedOriginalPrice = localProduct ? localProduct.original_price : (prod.price || 0);

          await SaleItem.create({
            sale_id: newSale.id,
            product_id: resolvedProductId,
            quantity: prod.quantity || 1,
            unit_price: prod.price || 0,
            original_price: resolvedOriginalPrice
          });

          // Deduct inventory
          try {
            const { AgentInventory } = require('../models');
            const inv = await AgentInventory.findOne({
              where: { agent_id: payment.agentId, product_id: resolvedProductId }
            });
            if (inv) {
              inv.stock = Math.max(0, inv.stock - (prod.quantity || 1));
              await inv.save();
            }
          } catch (invErr) {
            console.warn("Inventory deduction failed:", invErr.message);
          }
        }
      } else {
        // Create a general item
        await SaleItem.create({
          sale_id: newSale.id,
          product_id: 1, // default product
          quantity: 1,
          unit_price: payment.amount,
          original_price: payment.amount
        });
      }

      // Create Transaction
      await Transaction.create({
        sale_id: newSale.id,
        payment_gateway: 'tinda',
        transaction_id: payment.id,
        status: 'paid',
        amount: payment.amount,
        paid_at: new Date()
      });

      // Find if a visit already exists for this agent and store today, then update/create it
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayTime = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
        const itemsData = {
          products: (payment.products || []).map(p => ({
            productName: p.productName || "Mahsulot",
            qty: p.quantity || 1,
            price: p.price || 0,
            productId: p.productId || p.id || 1,
            barcode: p.barcode || '',
            markedLabel: p.markedLabel || (p.markedLabels && p.markedLabels[0]) || ''
          })),
          tindaPayload: payment.payload || null
        };
        const itemsJson = JSON.stringify(itemsData);

        const [visit, created] = await StoreVisit.findOrCreate({
          where: {
            agent_id: payment.agentId,
            store_id: parseInt(storeId),
            date: todayStr
          },
          defaults: {
            agent_id: payment.agentId,
            store_id: parseInt(storeId),
            status: 'sold',
            reason: '',
            items: itemsJson,
            date: todayStr,
            time: todayTime
          }
        });

        if (!created) {
          visit.status = 'sold';
          visit.reason = '';
          visit.items = itemsJson;
          visit.time = todayTime;
          await visit.save();
          console.log(`Updated existing visit ID: ${visit.id} to status 'sold'`);
        } else {
          console.log(`Created new sold visit ID: ${visit.id}`);
        }
      } catch (visitErr) {
        console.warn("Failed to create/update StoreVisit in DB:", visitErr.message);
      }

    } catch (dbErr) {
      console.warn("DB Sale creation failed, using mock mode fallback:", dbErr.message);
      // Mock Mode fallback
      if (!global.mockSales) {
        global.mockSales = [];
      }
      const mockSale = {
        id: `MOCK-SALE-${Date.now()}`,
        agent_id: payment.agentId,
        store_id: parseInt(storeId),
        total_amount: payment.amount,
        status: 'completed',
        createdAt: new Date().toISOString(),
        items: (payment.products || []).map(p => ({
          productName: p.productName || 'Mahsulot',
          quantity: p.quantity || 1,
          unit_price: p.price || 0
        }))
      };
      global.mockSales.push(mockSale);
    }

    // Remove from unassigned queue
    if (dbCallback) {
      await dbCallback.destroy();
    }
    const fallbackIdx = (global.tindaUnassignedCallbacks || []).findIndex(
      c => c.id === paymentId
    );
    if (fallbackIdx !== -1) {
      global.tindaUnassignedCallbacks.splice(fallbackIdx, 1);
    }

    return res.json({ success: true, message: 'Payment successfully assigned and sale registered' });
  } catch (error) {
    console.error("Error in assign-payment:", error);
    return res.status(500).json({ error: error.message });
  }
});

// 12. POST /unassign-payment (Put a payment back into the unassigned queue)
router.post('/unassign-payment', async (req, res) => {
  try {
    const { serialNumber, payload } = req.body;
    if (!serialNumber || !payload) {
      return res.status(400).json({ error: 'serialNumber and payload are required' });
    }

    const agentId = await getAgentIdBySerialNumber(serialNumber);
    if (!agentId) {
      return res.status(404).json({ error: 'Agent not found for this terminal serial number' });
    }

    const { Op } = require('sequelize');
    const dbExists = await TindaCallback.findOne({
      where: {
        [Op.or]: [
          { id: String(transId) },
          { payload: { [Op.like]: `%${transId}%` } }
        ]
      }
    });

    if (!dbExists) {
      const callbackId = `PEND-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await TindaCallback.create({
        id: callbackId,
        agent_id: agentId,
        serial_number: serialNumber,
        amount: parseFloat(payload.total_amount || payload.amount || 0),
        products: JSON.stringify(payload.products || []),
        status: 'pending',
        payload: JSON.stringify(payload)
      });

      if (!global.tindaUnassignedCallbacks) {
        global.tindaUnassignedCallbacks = [];
      }
      global.tindaUnassignedCallbacks.push({
        id: callbackId,
        agentId: agentId,
        serialNumber: serialNumber,
        amount: parseFloat(payload.total_amount || payload.amount || 0),
        products: payload.products || [],
        timestamp: Date.now(),
        status: 'pending',
        payload: payload
      });
      console.log(`Payment manually put back to unassigned queue in DB & global for Agent ID: ${agentId}`);
    }

    return res.json({ success: true, message: 'Payment moved to unassigned queue' });
  } catch (error) {
    console.error("Error in unassign-payment:", error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /debug - Check webhook log history and DB terminal SN assignments
router.get('/debug', async (req, res) => {
  try {
    const { User } = require('../models');
    let users = [];
    try {
      users = await User.findAll({
        attributes: ['id', 'username', 'name', 'role', 'terminal_sn', 'is_active']
      });
    } catch (err) {
      users = `DB lookup failed: ${err.message}`;
    }

    return res.json({
      unassignedCallbacksCount: (global.tindaUnassignedCallbacks || []).length,
      unassignedCallbacks: global.tindaUnassignedCallbacks,
      webhookLogsCount: (global.tindaWebhookLogs || []).length,
      webhookLogs: global.tindaWebhookLogs,
      activeCallbacks: global.tindaCallbacks,
      mockTerminalMappings: global.mockTerminalMappings,
      usersInDb: users,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
