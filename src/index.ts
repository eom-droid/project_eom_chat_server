import { Server } from "socket.io";
import mongoose from "mongoose";
import amqp from "amqplib";

const server = async () => {
  const {
    MONGO_URI,
    MONGO_URI_SUFFIX,
    NODE_ENV,
    PORT,
    AMQP_URL,
    AMQP_QUEUE_NAME,
  } = process.env;
  // .env 파일 내에 있는 변수들이 없을 경우 에러를 던짐
  if (!MONGO_URI) throw new Error("MONGO_URI is required!!!");
  if (!MONGO_URI_SUFFIX) throw new Error("MONGO_URI_SUFFIX is required!!!");
  if (!NODE_ENV) throw new Error("NODE_ENV is required!!!");
  if (!PORT) throw new Error("PORT is required!!!");
  if (!AMQP_URL) throw new Error("AMQP_URL is required!!!");
  if (!AMQP_QUEUE_NAME) throw new Error("QUEUE_NAME is required!!!");

  await connectMongoDB({ MONGO_URI, MONGO_URI_SUFFIX, NODE_ENV });
  await connectToRabbitMQ({ AMQP_URL, AMQP_QUEUE_NAME });
  await socketPart({ PORT });
};

async function connectMongoDB({
  MONGO_URI,
  MONGO_URI_SUFFIX,
  NODE_ENV,
}: {
  MONGO_URI: string;
  MONGO_URI_SUFFIX: string;
  NODE_ENV: string;
}) {
  try {
    // mongoose를 통해 MongoDB에 연결
    await mongoose.connect(MONGO_URI + NODE_ENV + MONGO_URI_SUFFIX);
    mongoose.set("debug", true);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

async function connectToRabbitMQ({
  AMQP_URL,
  AMQP_QUEUE_NAME,
}: {
  AMQP_URL: string;
  AMQP_QUEUE_NAME: string;
}) {
  try {
    const connection = await amqp.connect(AMQP_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(AMQP_QUEUE_NAME!, { durable: false });
    console.log("RabbitMQ connected");
  } catch (error) {
    console.error("Error connecting to RabbitMQ:", error);
    throw error;
  }
}

// socket part
async function socketPart({ PORT }: { PORT: string }) {
  const io = new Server({
    path: "/socket.io",
  });

  io.use((socket, next) => {
    console.log(socket);
    console.log(socket.request);

    next();
  });
  const room = io.of("/room");
  const chat = io.of("/chat");

  room.on("connection", (socket) => {});

  // io.on("connection", (socket) => {
  //   console.log("a user connected");
  //   socket.on("message", (message) => {
  //     console.log(message);
  //     socket.emit("message", message);
  //   });

  //   socket.on("msg", (msg) => {
  //     console.log(msg);
  //     socket.emit("shit", msg);
  //   });
  //   socket.on("disconnect", () => {
  //     console.log("user disconnected");
  //     setTimeout(() => {
  //       io.emit("message", "user disconnected");
  //     }, 1000);
  //   });
  // });

  io.listen(Number(PORT));
  console.log(`server listening on port ${PORT}`);
}

server();
