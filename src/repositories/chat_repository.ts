import { Chat, ChatModel } from "../models/chat_model";
import { ChatMemberModel } from "../models/chat_member_model";
import { ChatRoomModel } from "../models/chat_room_model";
import { Types } from "mongoose";
import { PaginateReqModel } from "../models/paginate_req_model";

export async function searchRoomByUserId(userId: string): Promise<
  Array<{
    _id: Types.ObjectId;
    title: string;
    max: number;
    lastChat: Chat;
    members: Array<{
      _id: Types.ObjectId;
      profileImg: string;
      nickname: string;
    }>;
  }>
> {
  try {
    // 가져와야되는 데이터 :
    // - 채팅방 id : _id  -> in chatRoom
    // - 채팅방 title : title -> in chatRoom
    // - 채팅방 썸네일(상대 user의 프로필 이미지) : thumbnail -> in chatMember -> in user
    // - 채팅방 최대 인원 수 : max -> in chatRoom
    // - 채팅방 현재 인원수 : currentUserCount -> in chatMember
    // - 마지막 채팅 : lastChat -> in chatRoom -> in chat
    // - 마지막 채팅 시간, : lastChatCreatedAt -> in chatRoom -> in chat

    // 1. chatMembers에서 자신이 속해있는 채팅방에대한 정보를 가져온다

    // 3. room의 정보를 바탕으로 chatMember테이블을 join한다 그리고 chatmemeber의 데이터로 user 정보를 가져온다
    // 4. room에 속해있는 user의 정보를 바탕으로 user의 profileImg들을 가져온다

    // 전제 : user가 chat_screen에 처음 들어가면 현재 본인이 속해있는 room에 대한 정보를 가져와야함
    // 따라서 그 요청 시 서버에서 받을 수 있는 항목은 userId 뿐임
    // collection : user, chatMember, chatRoom, chat

    const result = await ChatMemberModel.aggregate([
      // 1. 처음에 ChatMember에서 match를 통해 본인이 속한 Room에 대한 정보를 알아냄
      {
        $match: {
          userId: new Types.ObjectId(userId),
        },
      },
      // 2. 실질적인 방에 대한 정보를 담고있는 chatRoom을 join함
      {
        $lookup: {
          // chatrooms를 join 하는데
          from: "chatrooms",
          // ChatMember의 roomId를 localField로
          localField: "roomId",
          // ChatRoom의 _id를 foreignField로
          foreignField: "_id",
          // 별칭은 room으로 진행하고
          as: "room",
          // 내부 Pipeline 추가
          // 실질적으로 아래 mongodb 팁을 보면 project를 단순히 다음 스테이지로 넘어가는 데이터를 위해서 사용한다면 생략이 가능하다고 했는데,
          // 예외사항으로 우리는 뒤에 Unwind를 진행하기 때문에 필요하다고 판단
          pipeline: [
            {
              $project: {
                _id: 1,
                title: 1,
                max: 1,
              },
            },
          ],
        },
      },
      // 위 1번 match를 진행하면 여러개의 데이터가 나옴
      // 실질적으로 1번의 결과와 2번의 결과는 1:1 매칭 관계임
      // 하지만 결과로 확인 시에 array로 나오기때문에 array를 풀어줌
      {
        $unwind: "$room",
      },
      // 3. chatmember에 대한 join을 진행함
      {
        $lookup: {
          from: "chatmembers",
          localField: "room._id",
          foreignField: "roomId",
          as: "members",
          // userId를 기준으로 join을 진행한다
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "user",
              },
            },
            {
              $unwind: "$user",
            },
            {
              $project: {
                _id: "$user._id",
                profileImg: "$user.profileImg",
                nickname: "$user.nickname",
                lastReadChatId: 1,
              },
            },
          ],
        },
      },
      // chat collection 중 제일 최신 1개를 가져옴
      // 단 room의 lastChatId를 기준으로 하지 않음
      // 왜냐하면 lastChatId는 chat의 _id를 가리키는데, chat의 _id는 생성될 때마다 새로운 값이기 때문에
      // lastChatId를 기준으로 하면 chat이 생성될 때마다 lastChatId가 바뀌게 되고, 이는 lastChat를 가져올 때 문제가 됨
      // 따라서 chat의 생성시간을 기준으로 가져옴
      // nullable
      {
        $lookup: {
          from: "chats",
          localField: "room._id",
          foreignField: "roomId",
          as: "lastChat",
          pipeline: [
            {
              $sort: { _id: -1 },
            },
            {
              $limit: 1,
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$lastChat",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          // _id는 chatRoom의 _id를 가져온다
          _id: "$room._id",
          // title은 chatRoom의 title을 가져온다
          title: "$room.title",
          // max는 chatRoom의 max를 가져온다
          max: "$room.max",
          // lastChat는 chatRoom의 lastChat을 가져온다
          lastChat: 1,
          // members는 chatMember의 members를 가져온다
          members: 1,
          lastReadChatId: 1,
        },
      },
    ]);
    console.log(result);

    return result;
  } catch (error) {
    return [];
  }
}

export const createChatRoom = async (userId: string, title: string) => {
  try {
    const chatRoom = await ChatRoomModel.create({
      title,
      max: 10,
    });

    return chatRoom;
  } catch (error) {
    throw error;
  }
};

export const createChatMember = async (userId: string, roomId: string) => {
  try {
    const chatMember = await ChatMemberModel.create({
      userId: new Types.ObjectId(userId),
      roomId: new Types.ObjectId(roomId),
    });

    return chatMember;
  } catch (error) {
    throw error;
  }
};

export const createChat = async ({
  userId,
  roomId,
  content,
}: {
  userId: string;
  roomId: string;
  content: string;
}) => {
  try {
    const chat = await ChatModel.create({
      userId: new Types.ObjectId(userId),
      roomId: new Types.ObjectId(roomId),
      content,
    });

    return chat;
  } catch (error) {
    throw error;
  }
};

export const searchUserInRoom = async ({
  roomId,
  userId,
}: {
  roomId: string;
  userId: string;
}) => {
  try {
    const chatMember = await ChatMemberModel.findOne({
      roomId: new Types.ObjectId(roomId),
      userId: new Types.ObjectId(userId),
    });

    return chatMember;
  } catch (error) {
    throw error;
  }
};

export const getChats = async ({
  paginateReq,
  roomId,
}: {
  paginateReq: PaginateReqModel;
  roomId: string;
}) => {
  try {
    const query = paginateReq.generateQuery(false);

    const result = await ChatModel.aggregate([
      {
        $match: {
          roomId: new Types.ObjectId(roomId),
          ...query,
        },
      },
      { $sort: { _id: -1 } },
      { $limit: paginateReq.count },
    ]);

    return result;
  } catch (error) {
    throw error;
  }
};

export const updateMultiChatRead = async ({
  roomId,
  chatId,
  userIds,
}: {
  roomId: string;
  chatId: string;
  userIds: Array<string>;
}) => {
  try {
    const result = await ChatMemberModel.updateMany(
      {
        roomId: new Types.ObjectId(roomId),
        userId: { $in: userIds.map((userId) => new Types.ObjectId(userId)) },
      },
      {
        $set: { lastReadChatId: new Types.ObjectId(chatId) },
      }
    );

    return result;
  } catch (error) {
    throw error;
  }
};

export const getLastestChat = async (roomId: string) => {
  try {
    const result = await ChatModel.findOne({
      roomId: new Types.ObjectId(roomId),
    }).sort({ _id: -1 });

    return result;
  } catch (error) {
    throw error;
  }
};
