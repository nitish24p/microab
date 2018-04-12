# microab
MicroAB is an A/B Testing API for express applications. Typically A/B testing frameworks provide an SDK bundle which affects page load time. Microab is a thin middleware for express application enabling A/B testing via a node server with persistence in redis.

<img src="./art/microab.png" width='200' height='200' align='middle'>

### Dependencies
1. [redis](https://www.npmjs.com/package/redis)
2. [Cookie parser](https://www.npmjs.com/package/cookie-parser)
3. [uniqid](https://www.npmjs.com/package/uniqid)

### Installation
```bash
npm install --save microab
```

### Usage
```javascript
const microab = require('microab');
const cookieParser = require('cookie-parser');


app.use(cookieParser());

const microabClient = microab.createClient({
  redis: {
    host: 'localhost',
    port: 6379
  }
});

microabClient.createTests([{
  name: 'Red Button',
  duration: 1, // duration in days
  percentage: 80 // percentage traffic
}, {
  name: 'Green Dropdown',
  duration: 1,
  percentage: 5
}
]);
```
> This will create 2 tests with their appt configs and store them in redis

### Check Test Results
```javascript

app.get('/', microabClient.checkFeatureResults('Red Button'), function (req, res) {
  console.log(res.locals);
  // use res.locals however you please
  res.send(res.locals);
});

```
This middleware will create an object in `res.locals` asper the test name for the home route. The middleware can used to check the ab test result for various routes.

```json
{
  "Red Button" : true / false
}
```
This can now be used in your route handler, in which ever way the developer wishes to.

## Local development

### Start Redis
```bash
redis-server
```

### To start
```bash
node examples/demo.js

http://localhost:3000/green
http://localhost:3000
```
should give you a response like this

```json
{
  "Red Button" : true
}
```

### Roadmap
1. Complete basic test cases
2. Create some for of tracking via a CLI interface
3. Implement a web interface where tests can be addded and edited


### Found a bug
File it [here](https://github.com/nitish24p/microab/issues)
