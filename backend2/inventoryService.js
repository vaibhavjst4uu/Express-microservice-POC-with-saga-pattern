const express = require('express');
const { Kafka } = require('kafkajs');
const { Inventory, sequelize } = require('./models');

const kafka = new Kafka({
  clientId: 'inventory-service',
  brokers: ['kafka:9092']
});

const admin = kafka.admin();
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'inventory-group' });

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
      if (event.type === 'ORDER_CREATED') {
        console.log('Order created:', event.order);
        
        const order = event.order;
        try {
          await Inventory.update(
            { quantity: sequelize.literal(`quantity - ${order.quantity}`) },
            { where: { product: order.product } }
          );
          await producer.send({
            topic: 'order-events',
            messages: [{ value: JSON.stringify({ type: 'INVENTORY_UPDATED', orderId: order.id }) }]
          });
        } catch (error) {
          console.error("bhaiya ji:",error);
          await producer.send({
            topic: 'order-events',
            messages: [{ value: JSON.stringify({ type: 'INVENTORY_UPDATE_FAILED', orderId: order.id }) }]
          });
        }
      }
    },
  });

  const app = express();
  app.use(express.json());

  app.listen(5002, () => {
    console.log('Inventory Service listening on port 5002');
  });
};

run().catch(console.error);