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
        this.fetchFromRedis('ALL_TESTS')
          .then(allTests => JSON.parse(allTests))
          .then(allTests => {
            // What if response is empty
            // Same client id but for a different test
            if (allTests[feature]) {
              this.userTests = allTests;
              res.locals[feature] = this.fetchTestResultsFromCache(feature, clientId);
              return next();
            } else {
              /*
              * Client id exists but for another Test
              * 
              * */
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
                  console.log(featureData);
                  this.fetchFromRedis('ALL_TESTS')
                    .then(response => JSON.parse(response))
                    .then(allTests => {
                      let allTestsObject = allTests;
                      /*
                      * Null check
                      * */
                      if (allTestsObject && allTestsObject[feature]) {
                        allTestsObject[feature][clientId] = this.shouldFeatureBeShown(featureData.percentage);
                      } else {
                        allTestsObject = {};
                        allTestsObject[feature] = {};
                        allTestsObject[feature][clientId] = this.shouldFeatureBeShown(featureData.percentage);
                      }

                      console.log('HELLO', this.userTests);

                      this.userTests = allTestsObject;
                      this.setInRedis('ALL_TESTS', JSON.stringify(this.userTests),
                        featureData.duration * this.secondsInADay, true);
                      res.locals[feature] = this.fetchTestResultsFromCache(feature, clientId);
                      return next();
                    })
                    .catch(e => console.log(e));
                })
                .catch(e => console.log(e));
            }
            
          });
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
          console.log(featureData);
          this.fetchFromRedis('ALL_TESTS')
            .then(response => JSON.parse(response))
            .then(allTests => {
              let allTestsObject = allTests;

              /*
              * Null check
              * */
              if (allTestsObject) {
                allTestsObject[feature][uniqueClientId] = this.shouldFeatureBeShown(featureData.percentage);
              } else {
                allTestsObject = {};
                allTestsObject[feature] = {};
                allTestsObject[feature][uniqueClientId] = this.shouldFeatureBeShown(featureData.percentage);
              }
              
              this.userTests = allTestsObject;
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
  const n = percentage;
  return !!n && Math.random() <= n;
};

Microab.prototype.fetchTestResultsFromCache = function(featureName, clientId) {
  console.log(this.userTests);
  const featureObject = this.userTests[featureName];
  return featureObject[clientId];
};


Microab.prototype.fetchFromRedis = function(key) {
  return this.redisClient.getAsync(key);
};

