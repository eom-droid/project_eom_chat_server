import { Server } from "socket.io";
import mongoose from "mongoose";
import amqp from "amqplib";
import { CustomWSErrorModel } from "./models/custom_ws_error_model";
import { User } from "./models/user_model";
import { AuthUtils } from "./utils/auth_utils";
import * as userRepository from "./repositories/user_repository";
import * as chatRepository from "./repositories/chat_repository";
import {
  CURRENT_ROOM_ID,
  PAGINATE_COUNT_DEFAULT,
  RoleType,
  USER_ID,
} from "./constant/default";
import { readFileSync } from "fs";
import { createServer } from "https";
import { PaginateReqModel } from "./models/paginate_req_model";
import { PaginateResModel } from "./models/paginate_res_model";

async function server() {
  const {
    MONGO_URI,
    MONGO_URI_SUFFIX,
    NODE_ENV,
    PORT,
    AMQP_URL,
    AMQP_QUEUE_NAME,
    HOST_NAME,
  } = process.env;
  // .env 파일 내에 있는 변수들이 없을 경우 에러를 던짐
  if (!MONGO_URI) throw new Error("MONGO_URI is required!!!");
  if (!MONGO_URI_SUFFIX) throw new Error("MONGO_URI_SUFFIX is required!!!");
  if (!NODE_ENV) throw new Error("NODE_ENV is required!!!");
  if (!PORT) throw new Error("PORT is required!!!");
  if (!AMQP_URL) throw new Error("AMQP_URL is required!!!");
  if (!AMQP_QUEUE_NAME) throw new Error("QUEUE_NAME is required!!!");
  if (!HOST_NAME) throw new Error("HOST_NAME is required!!!");

  await connectMongoDB({ MONGO_URI, MONGO_URI_SUFFIX, NODE_ENV });
  // await connectToRabbitMQ({ AMQP_URL, AMQP_QUEUE_NAME });
  await socketPart({ PORT, HOST_NAME });
}

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
async function socketPart({
  PORT,
  HOST_NAME,
}: {
  PORT: string;
  HOST_NAME: string;
}) {
  var server;
  try {
    var privateKey = readFileSync(
      "/etc/letsencrypt/live/" + HOST_NAME + "/privkey.pem"
    );
    var certificate = readFileSync(
      "/etc/letsencrypt/live/" + HOST_NAME + "/cert.pem"
    );
    var ca = readFileSync("/etc/letsencrypt/live/" + HOST_NAME + "/chain.pem");

    const httpsServer = createServer({
      key: privateKey,
      cert: certificate,
      ca: ca,
    });
    server = new Server(httpsServer, {
      path: "/project-eom/chat-server",
    });
  } catch (e) {
    server = new Server({
      path: "/project-eom/chat-server",
    });
  }

  const io = server;

  const chatSocket = io.of("/chat");

  chatSocket.on("connection", async (socket) => {
    socket.on("getChatRoom", async (arg, response) => {
      // 1. user check
      const userId = socket.data[USER_ID];
      const user = await userRepository.searchUserById(userId);
      if (user === null) {
        response({
          status: 401,
          message: "no User",
        });
        socket.disconnect();
        return;
      }
      // 2. 유저 기반으로 room 확인하기
      var rooms = await chatRepository.searchRoomByUserId(userId);

      // 3. 아무 room이 없다면 새로 만든다(해당 유저가 user인 경우)
      if (rooms.length === 0 && user.role === RoleType.USER) {
        await createChatRooms(userId);
        rooms = await chatRepository.searchRoomByUserId(userId);
      }
      // 4. response
      response({
        status: 200,
        data: rooms,
      });

      // 5. rooms에 속해있는 방들에 join
      rooms.map((room) => {
        const roomId = room._id.toString();
        socket.join(roomId);
      });
      console.log("getChatRoom done");
    });

    socket.on("enterRoom", async (data, response) => {
      const { roomId } = data;
      const userId = socket.data[USER_ID];

      if (roomId === undefined || roomId === null) {
        socket.emit("enterRoomRes", {
          message: "data is not enough",
          roomId: roomId,
          status: 400,
        });
      }
      socket.data[CURRENT_ROOM_ID] = data.roomId;

      // 1. 현재 들어온 인원에 대한 user의 마지막 읽은 chat을 제일 최신으로 업데이트 한다
      const lastChat = await chatRepository.getLastestChat(roomId);
      if (lastChat !== null) {
        chatRepository.updateMultiChatRead({
          roomId: roomId,
          chatId: lastChat._id.toString(),
          userIds: [userId],
        });
      }

      const respData = {
        status: 200,
        roomId: roomId,
        data: {
          lastChatId: lastChat === null ? "no chat" : lastChat._id.toString(),
          userId: socket.data[USER_ID],
        },
      };

      // 현재 user에게 발송
      response(respData);

      // 나머지 유저에게 발송
      socket.broadcast.to(roomId).emit("enterRoomOtherUser", respData);

      return;
    });

    socket.on("postMessage", async (data, response) => {
      try {
        const { accessToken, roomId, content, tempMessageId } = data;

        // undefined 검사
        if (
          accessToken === undefined ||
          roomId === undefined ||
          content === undefined ||
          tempMessageId === undefined
        ) {
          response({
            message: "data is not enough",
            status: 400,
            roomId: roomId === undefined ? null : roomId,
            tempMessageId: tempMessageId === undefined ? null : tempMessageId,
          });
          return;
        }
        // 1. 토큰 검증
        const senderId = await verifyToken(accessToken);
        // 2. userId로 user 검색
        // 3. userId로 user가 보내준 message의 roomId가 속해있는지 검사
        const [user, room] = await Promise.all([
          userRepository.searchUserById(senderId),
          chatRepository.searchUserInRoom({
            roomId: roomId,
            userId: senderId,
          }),
        ]);
        if (user === null || room === null) {
          response({
            message: "No user or room",
            status: 401,
            roomId: roomId,
            tempMessageId: tempMessageId,
          });
          return;
        }

        // 4. socket.data와 message의 roomId와 userId가 같은지 검사
        if (
          socket.data[CURRENT_ROOM_ID] !== roomId ||
          socket.data[USER_ID] !== senderId
        ) {
          response({
            message: "different info between socket and message",
            status: 400,
            roomId: roomId,
            tempMessageId: tempMessageId,
          });

          return;
        }

        // 4. db 적재
        const chat = await chatRepository.createChat({
          roomId: roomId,
          userId: senderId,
          content: content,
        });

        const chatId = chat._id.toString();
        var clients = await socket.in(roomId).fetchSockets();

        // 5. 읽음 처리 준비
        const innerRoomClientIds = clients.reduce((acc, client) => {
          if (client.data[CURRENT_ROOM_ID] === roomId) {
            acc.push(client.data[USER_ID]);
          }
          return acc;
        }, [] as string[]);

        // 6. 내부 메시지 전송
        // chatSocket.to(roomId).emit("getMessageRes", {

        const respData = {
          status: 200,
          roomId: roomId,
          data: {
            ...chat.toJSON(),
            readUserIds: innerRoomClientIds,
            tempMessageId: tempMessageId,
          },
        };
        // 발송한 유저에게 response
        response(respData);
        // 모든 유저에게 발송
        chatSocket.to(roomId).emit("newMessage", respData);

        // 7. 읽음 처리
        await chatRepository.updateMultiChatRead({
          roomId: roomId,
          chatId: chatId,
          userIds: innerRoomClientIds,
        });
        return;
      } catch (err: any) {
        console.log(err);
        response({
          message: err.message || "something got wrong",
          status: err.status || 500,
          roomId: data.roomId === undefined ? null : data.roomId,
          tempMessageId: data.tempMessageId,
        });
      }
    });

    socket.on("leaveRoomReq", (data) => {
      socket.data[CURRENT_ROOM_ID] = null;
    });

    socket.on("disconnect", () => {
      socket.data[CURRENT_ROOM_ID] = null;
      socket.data[USER_ID] = null;
      socket.disconnect();
    });

    // 기존에 token 검증을 진행하였으나
    // socket.data에 userId가 없다면 connection이 연결되지 않기때문에 생각할 필요가 없음
    socket.on("getMessages", async (data, response) => {
      try {
        const { roomId, paginationParams } = data;
        // undefined 검사
        if (roomId === undefined || paginationParams === undefined) {
          response({
            message: "data is not enough",
            roomId: roomId === undefined ? null : roomId,
            status: 400,
          });
          return;
        }

        // 방에 속해있는지 검사
        // if (socket.data[CURRENT_ROOM_ID] !== roomId) {
        //   response({
        //     message: "you are not in the room",
        //     roomId: roomId,
        //     status: 400,
        //   });
        //   return;
        // }

        // 4. pagination 처리
        const paginateMessageRes = await chatRepository.getChats({
          paginateReq: new PaginateReqModel(paginationParams),
          roomId: roomId,
        });
        // 5. paginateMessageRes 전송
        response({
          status: 200,
          roomId: roomId,
          data: new PaginateResModel({
            meta: {
              count: paginateMessageRes.length,
              hasMore: paginateMessageRes.length === PAGINATE_COUNT_DEFAULT,
            },
            data: paginateMessageRes,
          }),
        });
      } catch (e: any) {
        console.log(e);
        response({
          message: e.message || "something got wrong",
          status: e.status || 500,
        });
      }
    });

    try {
      // 1. 토큰 검증
      const userId = await verifyToken(socket.request.headers.authorization);
      // 2. userId로 user 검색
      const user = await userRepository.searchUserById(userId);
      if (user === null) {
        throw new CustomWSErrorModel({
          message: "No user",
          status: 400,
        });
      }

      // socket.data에 userId를 등록함
      socket.data[USER_ID] = userId;
      socket.data[CURRENT_ROOM_ID] = null;
      socket.emit("connected", "connected");
    } catch (err: any) {
      console.log(err);
      socket.disconnect();
    }
  });

  // httpsServer.listen(Number(PORT));
  io.listen(Number(PORT));
  console.log(`server listening on port ${PORT}`);
}

server();

export const createChatRooms = async (userId: string) => {
  try {
    const appOwner = await userRepository.searchUsersByRole(RoleType.ADMIN);

    for (let i = 0; i < appOwner.length; i++) {
      const ownerId = appOwner[i]._id.toString();
      const room = await chatRepository.createChatRoom(ownerId, "엄태호");
      const roomId = room._id.toString();

      await Promise.all([
        chatRepository.createChatMember(ownerId, roomId),
        chatRepository.createChatMember(userId, roomId),
      ]);
    }
  } catch (error) {
    throw new CustomWSErrorModel({
      message: "createChatRooms error",
      status: 500,
    });
  }
};

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
