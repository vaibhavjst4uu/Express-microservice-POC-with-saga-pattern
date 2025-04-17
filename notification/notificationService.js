const express = require('express');
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: ['kafka:9092']
});

const admin = kafka.admin();
const consumer = kafka.consumer({ groupId: 'notification-group' });

const run = async () => {
  await admin.connect();
  await consumer.connect();

  await admin.createTopics({
    topics: [{ topic: 'order-events', numPartitions: 1, replicationFactor: 1 }]
  });
  console.log('Kafka topic created successfully');

  await consumer.subscribe({ topic: 'order-events', fromBeginning: true });
  consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const event = JSON.parse(message.value.toString());
      if (event.type === 'PAYMENT_SUCCESS') {
        const orderId = event.orderId;
        console.log(`Order ${orderId} processed successfully.`);
        // Send success notification
      } else if (event.type === 'PAYMENT_FAILED' || event.type === 'COMPENSATE_ORDER') {
        const orderId = event.orderId;
        console.log(`Order ${orderId} failed.`);
        // Send failure notification
      }
    },
  });

  const app = express();
  app.use(express.json());

  app.listen(5004, () => {
    console.log('Notification Service listening on port 5004');
  });
};

run().catch(console.error);