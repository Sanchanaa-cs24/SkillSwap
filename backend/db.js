const { MONGODB_URI } = require('./config');

const provider = MONGODB_URI ? 'mongo' : 'libsql';

module.exports =
  provider === 'mongo' ? require('./db-mongo') : require('./db-libsql');
