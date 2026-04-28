const axios = require('axios');

async function test() {
  try {
    const response = await axios.post('http://localhost:5001/api/scrape', {
      url: 'https://www.photowall.com/us/customer-service/contact-us',
      depth: 0
    });
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

test();
