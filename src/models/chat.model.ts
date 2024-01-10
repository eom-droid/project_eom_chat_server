import { InferSchemaType, Schema, model } from "mongoose";

const ChatSchema = new Schema(
  {
    roomId: { type: String, required: true },
    userId: { type: String, required: true },
    content: { type: String, required: true },
    read: { type: Boolean, required: true },
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
