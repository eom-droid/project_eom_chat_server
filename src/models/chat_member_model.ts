import { InferSchemaType, Schema, model } from "mongoose";

const ChatMemberSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, required: true, ref: "chatRoom" },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "user" },
    lastReadChatId: {
      type: Schema.Types.ObjectId,
      required: false,
      ref: "chat",
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

export type ChatMember = InferSchemaType<typeof ChatMemberSchema>;

export const ChatMemberModel = model("chatMember", ChatMemberSchema);
