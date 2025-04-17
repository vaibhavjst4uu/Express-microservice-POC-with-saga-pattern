const express = require('express');
const { Kafka } = require('kafkajs');
const { Order } = require('./models');

const kafka = new Kafka({
  clientId: 'order-service',
  brokers: ['kafka:9092']
});

const admin = kafka.admin();
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'order-group' });

const run = async () => {
  await admin.connect();
  await producer.connect();
  await consumer.connect();

  // Ensure the topic is created
  await admin.createTopics({
    topics: [{ topic: 'order-events', numPartitions: 1, replicationFactor: 1 }]
  });
  console.log('Kafka topic created successfully');

  // Consume messages
  await consumer.subscribe({ topic: 'order-events', fromBeginning: true });

  consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const event = JSON.parse(message.value.toString());
      if (event.type === 'COMPENSATE_ORDER') {
        const { orderId } = event;
        await Order.update({ status: 'cancelled' }, { where: { id: orderId } });
        console.log(`Order ${orderId} compensated and cancelled.`);
      }
    },
  });

  // Set up Express app
  const app = express();
  app.use(express.json());

  app.post('/order', async (req, res) => {
    try {
      const { product, quantity } = req.body;
      const order = await Order.create({ product, quantity, status: 'created' });

      await producer.send({
        topic: 'order-events',
        messages: [{ value: JSON.stringify({ type: 'ORDER_CREATED', order }) }]
      });
      res.status(200).send('Order created');
    } catch (error) {
      res.status(500).send('Error creating order');
    }
  });

  app.listen(5001, () => {
    console.log('Order Service listening on port 5001');
  });
};

run().catch(console.error);