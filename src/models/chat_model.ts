import { InferSchemaType, Schema, model } from "mongoose";

const ChatSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, required: true, ref: "chatRoom" },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "user" },
    content: { type: String, required: true },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

export type Chat = InferSchemaType<typeof ChatSchema>;

export const ChatModel = model("chat", ChatSchema);

// {
//   $lookup: {
//     from: 'members',
//     let: { roomId: '$_id' },
//     pipeline: [
//       {
//         $match: {
//           $expr: {
//             $eq: ['$roomId', '$$roomId'],
//           },
//         },
//       },
//       {
//         $lookup: {
//           from: 'users',
//           localField: 'userId',
//           foreignField: '_id',
//           as: 'user',
//         },
//       },
//       {
//         $unwind: '$user',
//       },
//       {
//         $project: {
//           _id: 1,
//           nickname: '$user.nickname',
//           profileImg: '$user.profileImg',
//         },
//       },
//     ],
//     as: 'members',
//   },
// },
