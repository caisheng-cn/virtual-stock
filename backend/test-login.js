/**
 * File: test-login.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Sends a test login request to the login API endpoint with
 *              hardcoded test credentials and prints the response.
 * Version History:
 *   - 2024-01-01: Initial version
 */

const http = require('http');

const data = JSON.stringify({
  username: 'testuser',
  password: '123456'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/users/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Response:', body);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(data);
req.end();