const microab = require('./../index');
const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');

const microabClient = microab.createClient({
  redis: {
    host: 'localhost',
    port: 6379
  }
});

microabClient.createTests([
  {
    name: 'Red Button',
    duration: 1,
    percentage: 80
  },
  {
    name: 'Green Dropdown',
    duration: 1,
    percentage: 5
  }
]);

app.use(cookieParser());

app.get('/', microabClient.checkFeatureResults('Red Button'), function(
  req,
  res
) {
  console.log(res.locals);
  res.send(res.locals);
});

app.get('/green', microabClient.checkFeatureResults('Green Dropdown'), function(
  req,
  res
) {
  console.log(res.locals);
  res.send(res.locals);
});

app.get('/yello', microabClient.checkFeatureResults('MWOW Dropdown'), function(
  req,
  res
) {
  console.log(res.locals);
  res.send(res.locals);
});

app.listen(3000, () => console.log('listening to port 3000'));
