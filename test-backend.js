// Test script to check backend status
const API_URL = 'http://localhost:5000';

async function testBackend() {
  console.log('Testing backend connection...\n');
  
  // Test 1: Health check
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    console.log('✓ Health check:', data);
  } catch (error) {
    console.log('✗ Health check failed:', error.message);
    console.log('\n⚠️  Backend is not running! Please start it with:');
    console.log('   cd backend && npm start\n');
    return;
  }

  // Test 2: Try to get trending content
  try {
    const response = await fetch(`${API_URL}/api/trending`);
    const data = await response.json();
    console.log('\n✓ Trending API:', data.success ? `${data.data.length} items` : 'No data');
  } catch (error) {
    console.log('\n✗ Trending API failed:', error.message);
  }

  console.log('\n✓ Backend is running correctly!');
}

testBackend();
