const express = require('express');
const { Kafka } = require('kafkajs');
const { Payment } = require('./models');

const kafka = new Kafka({
  clientId: 'payment-service',
  brokers: ['kafka:9092']
});

const admin = kafka.admin();
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'payment-group' });

const run = async () => {
  await admin.connect();
  await producer.connect();
  await consumer.connect();

  await admin.createTopics({
    topics: [{ topic: 'order-events', numPartitions: 1, replicationFactor: 1 }]
  });
  console.log('Kafka topic created successfully');

  await consumer.subscribe({ topic: 'order-events', fromBeginning: true });
  consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const event = JSON.parse(message.value.toString());
      if (event.type === 'INVENTORY_UPDATED') {
        const orderId = event.orderId;
        try {
          await Payment.create({ orderId, status: 'completed' });
          await producer.send({
            topic: 'order-events',
            messages: [{ value: JSON.stringify({ type: 'PAYMENT_SUCCESS', orderId }) }]
          });
        } catch (error) {
          await producer.send({
            topic: 'order-events',
            messages: [{ value: JSON.stringify({ type: 'PAYMENT_FAILED', orderId }) }]
          });
        }
      } else if (event.type === 'INVENTORY_UPDATE_FAILED') {
        const orderId = event.orderId;
        await producer.send({
          topic: 'order-events',
          messages: [{ value: JSON.stringify({ type: 'COMPENSATE_ORDER', orderId }) }]
        });
      }
    },
  });

  const app = express();
  app.use(express.json());

  app.listen(5003, () => {
    console.log('Payment Service listening on port 5003');
  });
};

run().catch(console.error);