const axios = require('axios');

async function checkChangelog() {
  try {
    const response = await axios.get('http://localhost:3005/system/changelog');
    console.log('Changelog Response:', JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('Error fetching changelog:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
  }
}

checkChangelog();
