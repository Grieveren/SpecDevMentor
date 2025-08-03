const http = require('http');

function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 5000,
    };

    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Testing Authentication Error Validation\n');

  const tests = [
    {
      name: 'Missing all fields',
      data: {},
      expectStatus: 400,
    },
    {
      name: 'Missing name',
      data: { email: 'test@example.com', password: 'ValidPass123!' },
      expectStatus: 400,
    },
    {
      name: 'Missing email',
      data: { name: 'Test User', password: 'ValidPass123!' },
      expectStatus: 400,
    },
    {
      name: 'Missing password',
      data: { name: 'Test User', email: 'test@example.com' },
      expectStatus: 400,
    },
    {
      name: 'Invalid email format',
      data: { name: 'Test User', email: 'invalid-email', password: 'ValidPass123!' },
      expectStatus: 400,
    },
    {
      name: 'Weak password (too short)',
      data: { name: 'Test User', email: 'test@example.com', password: '123' },
      expectStatus: 400,
    },
    {
      name: 'Weak password (no uppercase)',
      data: { name: 'Test User', email: 'test@example.com', password: 'weakpass123!' },
      expectStatus: 400,
    },
    {
      name: 'Valid registration',
      data: {
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        password: 'ValidPass123!',
      },
      expectStatus: 201,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      const result = await makeRequest(test.data);

      if (result.status === test.expectStatus) {
        console.log(`✅ PASS (${result.status})`);
        passed++;
      } else {
        console.log(`❌ FAIL - Expected ${test.expectStatus}, got ${result.status}`);
        console.log(`   Response: ${JSON.stringify(result.data)}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR - ${error.message}`);
      failed++;
    }
    console.log('');
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed');
  }
}

runTests().catch(console.error);
