/*
* Main Api of Microab
*
*/

const redis = require('./redis');
const uniqid = require('uniqid');
const Util = require('./util');

exports.createClient = function(options) {
  return new Microab(options);
};

function Microab(options) {
  this.redisClient = redis.configureRedisFactory(options);
  this.secondsInADay = 86400;
  this.userTests = {};
  this.ALL_TESTS_KEY = 'ALL_TESTS';
}

/*
* Config object
 options = [{name: 'red button', duration: 5, percentage: 40 ,}]
* TODO: ALTER CONFIG TO TAKE INTO ACCT EXISTING TESTS
*
*/
Microab.prototype.createTests = function(options) {
  const optionsWithTimeStamp = Util.addTimeStamp(options);
  optionsWithTimeStamp.forEach(test => {
    // This function should first check if that test exists in redis if it does, update the duration field
    this.setInRedis(
      test.name,
      JSON.stringify(test),
      test.duration * this.secondsInADay,
      true
    );
  });
};

Microab.prototype.setInRedis = function(key, value, duration, shouldExpire) {
  if (shouldExpire) {
    this.redisClient.set(key, value, 'EX', duration * this.secondsInADay);
  } else {
    this.redisClient.set(key, value);
  }
};

Microab.prototype.checkFeatureResults = function(featureName) {
  const feature = featureName;

  return (req, res, next) => {
    const clientId = req.cookies.clientId;
    if (clientId) {
      //Existing User

      /*
      * Check if feature exists in local cache and return
      * */
      if (this.userTests.hasOwnProperty(feature)) {
        const featureCache = this.fetchTestResultsFromCache(feature, clientId);
        if (
          typeof featureCache !== 'undefined' &&
          (featureCache.toString() === 'true' ||
            featureCache.toString() === 'false')
        ) {
          res.locals[feature] = featureCache;
          return next();
        }

        this.setNewFeatureData(feature, clientId)
          .then(featureData => {
            res.locals[feature] = featureData;
            res.cookie('clientId', clientId);
            return next();
          })
          .catch(e => console.log(e));
      } else {
        this.setNewFeatureData(feature, clientId)
          .then(featureData => {
            res.locals[feature] = featureData;
            res.cookie('clientId', clientId);
            return next();
          })
          .catch(e => console.log(e));
      }
    } else {
      const uniqueClientId = uniqid();
      this.setNewFeatureData(feature, uniqueClientId)
        .then(featureData => {
          res.locals[feature] = featureData;
          res.cookie('clientId', uniqueClientId);
          return next();
        })
        .catch(e => console.log(e));
    }
  };
};

Microab.prototype.setNewFeatureData = function(feature, clientId) {
  return this.fetchFromRedis(feature)
    .then(response => JSON.parse(response))
    .then(featureData => {
      if (!featureData) {
        return null;
      }

      return this.getFeatureDetails(feature, featureData, clientId);
    });
};

Microab.prototype.getFeatureDetails = function(feature, featureData, clientId) {
  return this.fetchFromRedis(this.ALL_TESTS_KEY)
    .then(response => JSON.parse(response))
    .then(allTests => {
      let allTestsObject = allTests;

      /*
      * Null check
      * */
      const shouldFeatureBeShown = this.shouldFeatureBeShown(
        featureData.percentage
      );
      if (allTestsObject && allTestsObject.hasOwnProperty(feature)) {
        allTestsObject[feature][clientId] = shouldFeatureBeShown;
      } else if (allTestsObject && !allTestsObject.hasOwnProperty(feature)) {
        allTestsObject[feature] = {};
        allTestsObject[feature][clientId] = shouldFeatureBeShown;
      } else {
        allTestsObject = {};
        allTestsObject[feature] = {};
        allTestsObject[feature][clientId] = shouldFeatureBeShown;
      }

      this.userTests = this.setTestsLocalCache(feature, {
        clientId: clientId,
        value: shouldFeatureBeShown
      });

      this.setInRedis(
        this.ALL_TESTS_KEY,
        JSON.stringify(this.userTests),
        featureData.duration * this.secondsInADay,
        true
      );

      return this.fetchTestResultsFromCache(feature, clientId);
    });
};

Microab.prototype.shouldFeatureBeShown = function(percentage) {
  const n = percentage / 100;
  return !!n && Math.random() <= n;
};

Microab.prototype.fetchTestResultsFromCache = function(featureName, clientId) {
  const featureObject = this.userTests[featureName];
  return featureObject[clientId];
};

Microab.prototype.setTestsLocalCache = function(feature, data) {
  let cacheCopy = this.userTests;
  if (cacheCopy && cacheCopy.hasOwnProperty(feature)) {
    cacheCopy[feature][data.clientId] = data.value;
  } else if (cacheCopy && !cacheCopy.hasOwnProperty(feature)) {
    cacheCopy[feature] = {};
    cacheCopy[feature][data.clientId] = data.value;
  } else {
    cacheCopy = {};
    cacheCopy[feature] = {};
    cacheCopy[feature][data.clientId] = data.value;
  }

  return Object.assign({}, cacheCopy);
};

Microab.prototype.fetchFromRedis = function(key) {
  return this.redisClient.getAsync(key);
};
