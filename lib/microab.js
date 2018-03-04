/*
* Main Api of Microab
*
*/

const redis = require('./redis');
const uniqid = require('uniqid');
const Util = require('./util');


/*
* Discuss if singleton is needed keep a flag
*/
exports.createClient = function(options) {
  return new Microab(options);
};


function Microab(options) {
  // consider adding validator for config
  this.redisClient = redis.configureRedisFactory(options);
  this.secondsInADay = 86400;
  this.userTests = {};
}


/*
* Config object
 options = [{name: 'red button', duration: days, percentage: ,}]
*
*
*/
Microab.prototype.createTests = function(options) {
  // consider adding validator for config
  const optionsWithTimeStamp = Util.addTimeStamp(options);
  console.log(optionsWithTimeStamp);
  optionsWithTimeStamp.forEach(test => {
    // This function should first check if that test exists in redis if it does, update the duration field
    this.setInRedis(test.name, JSON.stringify(test), test.duration * this.secondsInADay, true);
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
    // TODO Add Setting To reddis to a function and return promise
    // Refactor Code TODO
    //

    if (clientId) {
      //Existing User

      /*
      * Check if feature exists in local cache and return
      * */
      if (this.userTests.hasOwnProperty(feature)) {
        res.locals[feature] = this.fetchTestResultsFromCache(feature, clientId);
        return next();
      } else {
        this.fetchFromRedis(feature)
          .then(response => JSON.parse(response))
          .then(featureData => {
            if (!featureData) {
              return next();
            }
            /*
            * featureData = {
              name: 'Red Button',
              duration: 1,
              percentage: 80
            }
            * */
            this.fetchFromRedis('ALL_TESTS')
              .then(response => JSON.parse(response))
              .then(allTests => {
                let allTestsObject = allTests;
                /*
                * Null check
                * */
                const shouldFeatureBeShown = this.shouldFeatureBeShown(featureData.percentage);
                if (allTestsObject && allTestsObject.hasOwnProperty(feature)) {
                  allTestsObject[feature][clientId] = shouldFeatureBeShown;
                } else if (allTestsObject && !allTestsObject.hasOwnProperty(feature)) {
                  allTestsObject[feature] = {};
                  allTestsObject[feature][clientId] = shouldFeatureBeShown;
                }
                else {
                  allTestsObject = {};
                  allTestsObject[feature] = {};
                  allTestsObject[feature][clientId] = shouldFeatureBeShown;
                }

                this.userTests = this.setTestsLocalCache(feature,
                  { clientId, value: this.shouldFeatureBeShown(featureData.percentage) });

                this.setInRedis('ALL_TESTS', JSON.stringify(this.userTests),
                  featureData.duration * this.secondsInADay, true);
                res.locals[feature] = this.fetchTestResultsFromCache(feature, clientId);
                return next();
              })
              .catch(e => console.log(e));
          })
          .catch(e => console.log(e));
      }
    } else {
      //New user
      const uniqueClientId = uniqid();
      this.fetchFromRedis(feature)
        .then(response => JSON.parse(response))
        .then(featureData => {
          if (!featureData) {
            return next();
          }
          /*
          * featureData = {
            name: 'Red Button',
            duration: 1,
            percentage: 80
          }
          * */
          this.fetchFromRedis('ALL_TESTS')
            .then(response => JSON.parse(response))
            .then(allTests => {
              let allTestsObject = allTests;

              /*
              * Null check
              * */
              const shouldFeatureBeShown = this.shouldFeatureBeShown(featureData.percentage);
              if (allTestsObject && allTestsObject.hasOwnProperty(feature)) {
                allTestsObject[feature][uniqueClientId] = shouldFeatureBeShown;
              } else if (allTestsObject && !allTestsObject.hasOwnProperty(feature)) {
                allTestsObject[feature] = {};
                allTestsObject[feature][uniqueClientId] = shouldFeatureBeShown;
              } else {
                allTestsObject = {};
                allTestsObject[feature] = {};
                allTestsObject[feature][uniqueClientId] = shouldFeatureBeShown;
              }

              this.userTests = this.setTestsLocalCache(feature, 
                { clientId: uniqueClientId, value: shouldFeatureBeShown});

              this.setInRedis('ALL_TESTS', JSON.stringify(this.userTests), 
                featureData.duration * this.secondsInADay, true);

              res.locals[feature] = this.fetchTestResultsFromCache(feature, uniqueClientId);
              res.cookie('clientId', uniqueClientId);
              return next();
            })
            .catch(e => console.log(e));
        })
        .catch(e => console.log(e));

    }
  };
};

Microab.prototype.shouldFeatureBeShown = function(percentage){
  const n = (percentage / 100);
  return !!n && Math.random() <= n;
};

Microab.prototype.fetchTestResultsFromCache = function(featureName, clientId) {
  console.log(this.userTests, 'FETCHING FROM CACHE');
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

