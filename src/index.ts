import { Server } from "socket.io";
import mongoose from "mongoose";
import amqp from "amqplib";
import { CustomWSErrorModel } from "./models/custom_ws_error_model";
import { User } from "./models/user_model";
import { AuthUtils } from "./utils/auth_utils";
import * as UserRepository from "./repositories/user_repository";
import * as ChatRepository from "./repositories/chat_repository";
import { PAGINATE_COUNT_DEFAULT, RoleType } from "./constant/default";
import { ChatRoom } from "./models/chat_room_model";
import { PaginateReqModel } from "./models/paginate_req_model";
import { count } from "console";
import { after } from "node:test";
import { PaginateResModel } from "./models/paginate_res_model";

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
    // mongoose.set("debug", function (collectionName, method, query, doc) {
    //   console.log(
    //     "Mongoose: " +
    //       collectionName +
    //       "." +
    //       method +
    //       " (" +
    //       JSON.stringify(query, null, 2) +
    //       ")"
    //   );
    // });
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

  const chatSocket = io.of("/chat");

  chatSocket.on("connection", async (socket) => {
    console.log("connection");
    try {
      // 1. 토큰 검증
      const userId = await verifyToken(socket.request.headers.authorization);
      // 2. userId로 user 검색
      const user = await getUser(userId);
      if (user === null) {
        throw new CustomWSErrorModel({
          message: "No user",
          status: 400,
        });
      }
      // 2. userId로 user가 속해있는 채팅방 검색
      var rooms = await ChatRepository.searchRoomByUserId(userId);

      // 3. 만약 rooms가 하나도 없다면 새로운 채팅방 생성
      if (rooms.length === 0 && user.role === RoleType.USER) {
        await createChatRooms(userId);

        rooms = await ChatRepository.searchRoomByUserId(userId);
      }

      socket.emit("getChatRoomsRes", {
        status: 200,
        data: rooms,
      });
    } catch (err: any) {
      console.log(err);
      socket.emit("getChatRoomsRes", {
        message: err.message || "something got wrong",
        status: err.status || 500,
      });
      socket.disconnect();
    }
    socket.on("joinRoomReq", async (data) => {
      try {
        const { accessToken, roomId } = data;
        if (accessToken === undefined || roomId === undefined) {
          socket.emit("joinRoomRes", {
            message: "data is not enough",
            status: 400,
          });
          return;
        }

        // 1. 토큰 검증
        const userId = await verifyToken(accessToken);
        // 2. userId로 user 검색
        // 3. userId와 roomId로 chatMember에서 유저가 있는지 확인(2번과 동기처리)
        const [user, room] = await Promise.all([
          getUser(userId),
          ChatRepository.searchUserInRoom({
            roomId: roomId,
            userId: userId,
          }),
        ]);
        if (user === null || room === null) {
          socket.emit("joinRoomRes", {
            message: "No user or room",
            status: 400,
          });
          return;
        }
        // 4. socket join
        await socket.join(roomId);

        // 5. pagination 처리
        const paginateMessageRes = await ChatRepository.getChats({
          paginateReq: new PaginateReqModel({
            count: PAGINATE_COUNT_DEFAULT,
          }),
          roomId: roomId,
        });
        // 6. paginateMessageRes 전송
        socket.emit("paginateMessageRes", {
          status: 200,
          data: new PaginateResModel({
            meta: {
              count: paginateMessageRes.length,
              hasMore: paginateMessageRes.length === PAGINATE_COUNT_DEFAULT,
            },
            data: paginateMessageRes,
          }),
        });

        return;
      } catch (err: any) {
        console.log(err);
        socket.emit("joinRoomRes", {
          message: err.message || "something got wrong",
          status: err.status || 500,
        });
      }
    });

    socket.on("postMessageReq", async (message) => {
      try {
        const { accessToken, roomId, content, tempMessageId } = message;

        if (
          accessToken === undefined ||
          roomId === undefined ||
          content === undefined ||
          tempMessageId === undefined
        ) {
          socket.emit("postMessageRes", {
            message: "data is not enough",
            status: 400,
            tempMessageId: tempMessageId === undefined ? null : tempMessageId,
          });
          return;
        }
        // 1. 토큰 검증
        const userId = await verifyToken(accessToken);
        // 2. userId로 user 검색
        // 3. userId로 user가 보내준 message의 roomId가 속해있는지 검사
        const [user, room] = await Promise.all([
          getUser(userId),
          ChatRepository.searchUserInRoom({
            roomId: roomId,
            userId: userId,
          }),
        ]);
        if (user === null || room === null) {
          socket.emit("postMessageRes", {
            message: "No user or room",
            status: 400,
            tempMessageId: tempMessageId,
          });
          return;
        }
        // 4. db 적재
        const chat = await ChatRepository.createChat({
          roomId: roomId,
          userId: userId,
          content: content,
        });

        // 5. 내부 메시지 전송
        chatSocket.to(roomId).emit("getMessageRes", {
          status: 200,
          data: {
            ...chat.toJSON(),
            tempMessageId: tempMessageId,
          },
        });
      } catch (err: any) {
        console.log(err);
        socket.emit("postMessageRes", {
          message: err.message || "something got wrong",
          status: err.status || 500,
          tempMessageId: message.tempMessageId,
        });
      }
    });

    socket.on("paginateMessageReq", async (data) => {
      const { roomId, paginationParams, accessToken } = data;

      if (
        roomId === undefined ||
        paginationParams === undefined ||
        accessToken === undefined
      ) {
        socket.emit("paginateMessageRes", {
          message: "data is not enough",
          status: 400,
        });
        return;
      }
      // 1. 토큰 검증
      const userId = await verifyToken(accessToken);
      // 2. userId로 user 검색
      // 3. userId와 roomId로 chatMember에서 유저가 있는지 확인(2번과 동기처리)
      const [user, room] = await Promise.all([
        getUser(userId),
        ChatRepository.searchUserInRoom({
          roomId: roomId,
          userId: userId,
        }),
      ]);
      if (user === null || room === null) {
        socket.emit("paginateMessageRes", {
          message: "No user or room",
          status: 400,
        });
        return;
      }
      // 4. pagination 처리
      const paginateMessageRes = await ChatRepository.getChats({
        paginateReq: new PaginateReqModel(paginationParams),
        roomId: roomId,
      });
      // 5. paginateMessageRes 전송
      socket.emit("paginateMessageRes", {
        status: 200,
        data: new PaginateResModel({
          meta: {
            count: paginateMessageRes.length,
            hasMore: paginateMessageRes.length === PAGINATE_COUNT_DEFAULT,
          },
          data: paginateMessageRes,
        }),
      });
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

    // if (user === null) {
    //   throw new CustomWSErrorModel({
    //     message: "No user",
    //     status: 401,
    //   });
    // }

    return user;
  } catch (error) {
    throw error;
  }
};
