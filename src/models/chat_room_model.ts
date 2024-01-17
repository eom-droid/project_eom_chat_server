import { InferSchemaType, Schema, model } from "mongoose";

const ChatRoomSchema = new Schema(
  {
    title: { type: String, required: true },
    max: { type: Number, required: true },
    lastChatId: { type: Schema.Types.ObjectId, required: false },
    // owner: { type: String, required: true },
    // password: { type: String, required: false },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

export type ChatRoom = InferSchemaType<typeof ChatRoomSchema>;

export const ChatRoomModel = model("chatRoom", ChatRoomSchema);
