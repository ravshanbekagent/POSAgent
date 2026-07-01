async function runTest() {
  const serialNumber = 'TEST-SN-999';
  console.log('1. Registering mock callback...');
  try {
    const mockRes = await fetch('http://localhost:5000/api/tinda/mock-callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serialNumber,
        products: [
          { productId: 1, productName: 'IQOS Iluma One (Pebble Grey)', price: 350000, quantity: 1 }
        ],
        totalAmount: 350000
      })
    });
    const mockData = await mockRes.json();
    console.log('Mock Registration Response:', mockData);

    console.log('\n2. Polling for the callback...');
    const pollRes = await fetch(`http://localhost:5000/api/tinda/callback/${serialNumber}`);
    const pollData = await pollRes.json();
    console.log('Polling Response:', pollData);

    if (pollData.found) {
      console.log('\n✅ TEST SUCCESSFUL: Callback registered and retrieved successfully!');
    } else {
      console.log('\n❌ TEST FAILED: Callback not found!');
    }
  } catch (error) {
    console.error('API Test Error:', error.message);
  }
}
runTest();
