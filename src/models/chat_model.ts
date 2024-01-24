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
