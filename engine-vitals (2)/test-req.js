import http from 'http';
const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/analyze',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk.toString());
  res.on('end', () => console.log('Status:', res.statusCode, 'Body start:', data.substring(0, 100)));
});
req.write(JSON.stringify({vehicle: {make: "Ford", model: "F150", year: 2020}}));
req.end();