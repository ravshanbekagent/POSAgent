const express = require('express');
const router = express.Router();

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
    if (!payload.products && payload.productList) {
      payload.products = payload.productList.map(p => ({
        productId: (p.product && p.product.id) || p.productId || p.id,
        productName: p.productName || (p.product && p.product.name) || 'Mahsulot',
        price: parseFloat(p.price || 0),
        quantity: parseInt(p.amount || p.quantity || 1),
        barcode: (p.barcodes && p.barcodes[0]) || (p.product && p.product.barcodes && p.product.barcodes[0]) || ''
      }));
    }
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
      const exists = global.tindaUnassignedCallbacks.some(c => 
        (payload.id && c.payload && c.payload.id === payload.id) || 
        (transId && c.payload && c.payload.sales_id === transId) || 
        (payload.receipt_number && c.payload && c.payload.receipt_number === payload.receipt_number) ||
        (payload.receiptNumber && c.payload && c.payload.receiptNumber === payload.receiptNumber)
      );
      if (!exists) {
        global.tindaUnassignedCallbacks.push({
          id: `PEND-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          agentId: agentId,
          serialNumber: serialNumber,
          amount: payload.total_amount,
          products: payload.products || [],
          timestamp: Date.now(),
          status: 'pending',
          payload: payload
        });
        console.log(`Unassigned payment added to queue for Agent ID: ${agentId}`);
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

    // Clean up corresponding pending unassigned payments since it's now consumed inside cashier screen
    if (global.tindaUnassignedCallbacks) {
      global.tindaUnassignedCallbacks = global.tindaUnassignedCallbacks.filter(
        c => c.serialNumber !== serialNumber
      );
    }

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

    // Create a mock payload resembling Tinda's structure
    const mockPayload = {
      sales_id: `MOCK-${Date.now()}`,
      receipt_number: Math.floor(Math.random() * 1000) + 1,
      date: new Date().toISOString(),
      serial_number: serialNumber,
      total_amount: totalAmount || 11750000,
      payment: {
        payment_method: 'by other cashless',
        amount: totalAmount || 11750000
      },
      products: products || [
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
      ]
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
router.get('/pending-payments/:agentId', (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const pending = (global.tindaUnassignedCallbacks || []).filter(
      c => c.agentId === agentId && c.status === 'pending'
    );
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

    const paymentIndex = (global.tindaUnassignedCallbacks || []).findIndex(
      c => c.id === paymentId
    );
    if (paymentIndex === -1) {
      return res.status(404).json({ error: 'Pending payment not found' });
    }

    const payment = global.tindaUnassignedCallbacks[paymentIndex];

    try {
      const { Sale, SaleItem, Transaction } = require('../models');

      // Create Sale in DB
      const newSale = await Sale.create({
        agent_id: payment.agentId,
        store_id: parseInt(storeId),
        total_amount: payment.amount,
        status: 'completed'
      });

      // Create Sale Items if products exist
      if (payment.products && payment.products.length > 0) {
        for (const prod of payment.products) {
          await SaleItem.create({
            sale_id: newSale.id,
            product_id: prod.productId || 1, // fallback to product 1
            quantity: prod.quantity || 1,
            unit_price: prod.price || 0,
            original_price: prod.price || 0
          });

          // Deduct inventory
          try {
            const { AgentInventory } = require('../models');
            const inv = await AgentInventory.findOne({
              where: { agent_id: payment.agentId, product_id: prod.productId || 1 }
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
    global.tindaUnassignedCallbacks.splice(paymentIndex, 1);

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

    const transId = payload.id || payload.salePublicId || payload.sales_id || payload.receipt_number || payload.receiptNumber || `PEND-${Date.now()}`;
    const exists = (global.tindaUnassignedCallbacks || []).some(c => 
      (payload.id && c.payload && c.payload.id === payload.id) || 
      (transId && c.payload && c.payload.sales_id === transId) || 
      (payload.receipt_number && c.payload && c.payload.receipt_number === payload.receipt_number) ||
      (payload.receiptNumber && c.payload && c.payload.receiptNumber === payload.receiptNumber)
    );

    if (!exists) {
      if (!global.tindaUnassignedCallbacks) {
        global.tindaUnassignedCallbacks = [];
      }
      global.tindaUnassignedCallbacks.push({
        id: `PEND-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        agentId: agentId,
        serialNumber: serialNumber,
        amount: parseFloat(payload.total_amount || payload.amount || 0),
        products: payload.products || [],
        timestamp: Date.now(),
        status: 'pending',
        payload: payload
      });
      console.log(`Payment manually put back to unassigned queue for Agent ID: ${agentId}`);
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
