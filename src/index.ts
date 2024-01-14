import { Server } from "socket.io";
import mongoose from "mongoose";
import amqp from "amqplib";
import { CustomWSErrorModel } from "./models/custom_http_error_model";
import { User } from "./models/user_model";
import { AuthUtils } from "./utils/auth_utils";
import * as UserRepository from "./repositories/user_repository";
import * as ChatRepository from "./repositories/chat_repository";
import { RoleType } from "./constant/default";
import { ChatRoom } from "./models/chat_room_model";

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
    path: "/project-eom/chat-server",
  });

  const room = io.of("/room");
  const chat = io.of("/chat");

  room.on("connection", async (socket) => {
    try {
      // 1. 토큰 검증
      const userId = await verifyToken(socket.request.headers.authorization);
      // 2. userId로 user 검색
      const user = await getUser(userId);
      // 2. userId로 user가 속해있는 채팅방 검색
      var rooms = await ChatRepository.searchRoomByUserId(userId);

      // 3. 만약 rooms가 하나도 없다면 새로운 채팅방 생성
      // if (rooms.length === 0 && user.role === RoleType.USER) {
      //   await createChatRooms(userId);

      //   rooms = await ChatRepository.searchRoomByUserId(userId);
      // }

      socket.emit("/", {
        status: 200,
        data: rooms,
      });
    } catch (err: any) {
      console.log(err);
      socket.emit("/", {
        message: err.message || "something got wrong",
        status: err.status || 500,
      });
      socket.disconnect();
    }
  });

  chat.on("connection", (socket) => {
    console.log("connection");

    socket.on("message", (message) => {
      console.log(message);
      socket.emit("message", message);
    });
  });

  io.listen(Number(PORT));
  console.log(`server listening on port ${PORT}`);
}

server();

export const createChatRooms = async (userId: string) => {
  try {
    const appOwner = await UserRepository.searchUsersByRole(RoleType.ADMIN);

    for (let i = 0; i < appOwner.length; i++) {
      const ownerId = appOwner[i]._id.toString();
      const room = await ChatRepository.createChatRoom(ownerId, "엄태호");
      const roomId = room._id.toString();

      await Promise.all([
        ChatRepository.createChatMember(ownerId, roomId),
        ChatRepository.createChatMember(userId, roomId),
      ]);
    }
  } catch (error) {
    throw new CustomWSErrorModel({
      message: "createChatRooms error",
      status: 500,
    });
  }
};

// export const getChatRooms = async (userId: string) => {
//   try {
//     const rooms = await ChatRo.searchRoomByUserId(userId);

//     return rooms;
//   } catch (error) {
//     throw error;
//   }
// }

export const verifyToken = async (
  authorization: string | undefined
): Promise<string> => {
  try {
    if (!authorization) {
      throw new CustomWSErrorModel({
        message: "No authorization",
        status: 401,
      });
    }

    const splitToken = authorization.split(" ");

    if (splitToken.length !== 2 || splitToken[0] !== "Bearer") {
      throw new CustomWSErrorModel({
        message: "No authorization",
        status: 401,
      });
    }

    const payload = AuthUtils.verifyToken(splitToken[1]);

    return payload.id;
  } catch (error: any) {
    // console.log(new Date().toISOString() + ": npm log: " + error);
    if (error instanceof CustomWSErrorModel) {
      throw error;
    } else {
      throw new CustomWSErrorModel({
        message: "No authorization",
        status: 401,
      });
    }
  }
};

export const getUser = async (userId: string) => {
  try {
    const user = await UserRepository.searchUserById(userId);

    if (user === null) {
      throw new CustomWSErrorModel({
        message: "No user",
        status: 401,
      });
    }

    return user;
  } catch (error) {
    throw error;
  }
};
