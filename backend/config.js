const path = require('path');
const { pathToFileURL } = require('url');
const dotenv = require('dotenv');

[
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '.env'),
  path.join(__dirname, '.env.local'),
].forEach((envPath) => {
  dotenv.config({ path: envPath, override: true, quiet: true });
});

const isVercel = Boolean(process.env.VERCEL);
const localDatabasePath = isVercel
  ? '/tmp/skillsswap.db'
  : path.join(__dirname, 'skillsswap.db');
const mongodbUri = String(process.env.MONGODB_URI || '').trim();

module.exports = {
  PORT: Number(process.env.PORT || 4000),
  AUTH_SECRET: process.env.AUTH_SECRET || 'skillsswap-demo-secret',
  TOKEN_TTL_MS: Number(
    process.env.TOKEN_TTL_MS || 1000 * 60 * 60 * 24 * 7
  ),
  MONGODB_URI: mongodbUri,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'skillsswap',
  DATABASE_URL:
    process.env.TURSO_DATABASE_URL ||
    process.env.DATABASE_URL ||
    pathToFileURL(localDatabasePath).href,
  DATABASE_AUTH_TOKEN:
    process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || '',
  SEED_DATA_FILE: path.join(__dirname, 'data.json'),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  isVercel,
};
