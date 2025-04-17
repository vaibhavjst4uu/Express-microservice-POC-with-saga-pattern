// apiGatewayService.js
const express = require('express');
const request = require('request');

const app = express();
app.use(express.json());

const services = {
  order: 'http://backend1:5001',
  inventory: 'http://backend2:5002',
  payment: 'http://backend3:5003',
};

app.post('/order', (req, res) => {
  request.post(`${services.order}/order`, { json: req.body }, (error, response, body) => {
    if (error) {
      return res.status(500).send('Order creation failed');
    }
    res.status(response.statusCode).send(body);
  });
});

app.listen(8080, () => {
  console.log('API Gateway Service listening on port 8080');
});