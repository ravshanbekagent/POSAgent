const express = require('express');
const router = express.Router();

// In-memory storage for active callbacks
// Structure: { [serialNumber]: { payload, timestamp } }
if (!global.tindaCallbacks) {
  global.tindaCallbacks = {};
}

// 1. Tinda Webhook Endpoint (Receives callback from Tinda/ERA)
router.post('/callback', (req, res) => {
  try {
    const payload = req.body;
    console.log('Received Tinda Webhook Callback:', JSON.stringify(payload, null, 2));

    // Try to find the serial number in standard fields
    const serialNumber = payload.serial_number || 
                         payload.serialNumber || 
                         (payload.payload && (payload.payload.serial_number || payload.payload.serialNumber));

    if (!serialNumber) {
      console.warn('Tinda callback received, but no serial number found in body.');
      return res.status(400).json({ success: false, error: 'serialNumber is required' });
    }

    // Store in global memory
    global.tindaCallbacks[serialNumber] = {
      payload: payload,
      timestamp: Date.now()
    };

    console.log(`Stored callback for Terminal Serial Number: ${serialNumber}`);
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
                         (payload.payload && (payload.payload.serial_number || payload.payload.serialNumber));

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
                         (payload.payload && (payload.payload.serial_number || payload.payload.serialNumber));

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

module.exports = router;
