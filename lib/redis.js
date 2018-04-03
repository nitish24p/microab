/*

* Redis factory
* initialise Client
*/

const redis = require('redis');
const bluebird = require('bluebird');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

exports.configureRedisFactory = function(options) {
  if (!options.hasOwnProperty('redis')) {
    throw new Error('Incorrect redis config object format');
  }
  const socket = options.redis.socket;
  const port = !socket ? options.redis.port || 6379 : null;
  const host = !socket ? options.redis.host || '127.0.0.1' : null;
  const db = !socket ? options.redis.db || 0 : null;
  const client = redis.createClient(
    socket || port,
    host,
    options.redis.options
  );
  if (options.redis.auth) {
    client.auth(options.redis.auth);
  }
  if (db >= 0) {
    client.select(db);
  }

  client.on('connect', () => {
    console.log('info', 'Microab redis connected');
  });

  client.on('error', error => {
    console.warn(error);
    console.log('info', 'Microab redis connection failure');
  });

  return client;
};
