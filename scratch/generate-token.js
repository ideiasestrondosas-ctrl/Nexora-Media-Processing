const { generateToken } = require('./src/api/middleware/auth');
require('dotenv').config();

async function main() {
  const token = await generateToken({ sub: 'test', roles: ['admin'] });
  console.log(token);
}
main().catch(console.error);
