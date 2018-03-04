
exports.addTimeStamp = function(testConfig) {
  return testConfig.map((test) => {
    test.timeStamp = new Date().getTime();
    return test;
  });
};