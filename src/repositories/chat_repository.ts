import { ChatModel } from "../models/chat.model";
import { ChatMemberModel } from "../models/chat_member_model";
import { ChatRoomModel } from "../models/chat_room_model";
import { Types } from "mongoose";

export const searchRoomByUserId = async (userId: string) => {
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
    const chatRooms = await ChatMemberModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "chatrooms",
          localField: "roomId",
          foreignField: "_id",
          as: "chatRoom",
        },
      },
      {
        $unwind: "$chatRoom",
      },
    ]);

    // 2. room의 정보를 바탕으로 user 정보를 가져온다
    // 3. room의 정보를 바탕으로 lastchat의 정보를 가져온다
    // 4. room에 속해있는 user의 정보를 바탕으로 user의 profileImg를 가져온다
    const result = await ChatRoomModel.aggregate([
      {
        $match: {
          _id: {
            $in: chatRooms.map((chatRoom) => chatRoom.roomId),
          },
        },
      },
      {
        $lookup: {
          from: "chatmembers",
          localField: "_id",
          foreignField: "roomId",
          as: "chatMembers",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "chatMembers.userId",
          foreignField: "_id",
          as: "chatMembers.user",
        },
      },
      {
        $lookup: {
          from: "chats",
          localField: "lastChat",
          foreignField: "_id",
          as: "lastChat",
        },
      },
      {
        $unwind: "$lastChat",
      },
      {
        $unwind: "$chatMembers",
      },
      {
        $project: {
          _id: 1,
          title: 1,
          // 내 프로필은 제외하고
          thumbnail: "$chatMembers.user.profileImg",
          max: 1,
          // $chatMembers의 길이를 구한다
          currentUserCount: { $size: "$chatMembers.user" },
          // currentUserCount: { $size: "$chatMembers" },
          lastChat: "$lastChat.content",
          lastChatCreatedAt: "$lastChat.createdAt",
        },
      },
    ]);

    console.log(result);
    return chatRooms;
  } catch (error) {
    throw error;
  }
};

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
