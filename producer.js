const amqp = require("amqplib");

async function sendMessage() {
  const connection = await amqp.connect(
    "amqp://chat_server_nodejs:1q2w3e4r!@localhost/chat_server_vhost"
  );
  const channel = await connection.createChannel();

  const queueName = "myQueue";
  const message = "Hello, RabbitMQ!";

  await channel.assertQueue(queueName, { durable: false });
  // 100회 반복
  for (let i = 0; i < 100; i++) {
    channel.sendToQueue(queueName, Buffer.from(message));
  }

  console.log(`Message sent: ${message}`);

  setTimeout(() => {
    connection.close();
    process.exit(0);
  }, 500);
}

sendMessage();
