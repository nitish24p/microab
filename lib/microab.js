/*
* Main Api of Microab
*
*/

const redis = require('./redis');

console.log(redis);

/*
* Discuss if singleton is needed keep a flag
*/
exports.createClient = function(options) {
  return new Microab(options);
}


function Microab(options) {
  // consider adding validator for config
  this.redisClient = redis.configureRedisFactory(options);
}

Microab.prototype.createTest = function(options) {
  // consider adding validator for config
}

