/**
 * File: test-register.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Sends a test registration request to the register API endpoint
 *              with hardcoded test credentials and invite code.
 * Version History:
 *   - 2024-01-01: Initial version
 */

const http = require('http');

const data = JSON.stringify({
  username: 'testuser',
  password: '123456',
  nickname: 'Test User',
  invite_code: 'DEFAULT2024'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/users/register',
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