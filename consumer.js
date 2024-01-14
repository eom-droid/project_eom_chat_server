const amqp = require("amqplib");

async function receiveMessage() {
  const connection = await amqp.connect(
    "amqp://chat_server_nodejs:1q2w3e4r!@localhost/chat_server_vhost"
  );
  const channel = await connection.createChannel();

  const queueName = "myQueue";

  await channel.assertQueue(queueName, { durable: false });
  console.log("Waiting for messages. To exit press CTRL+C");

  channel.consume(queueName, (msg) => {
    if (msg !== null) {
      console.log(`Received message: ${msg.content.toString()}`);
      channel.ack(msg);
    }
  });
}

receiveMessage();
