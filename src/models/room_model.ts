import { InferSchemaType, Schema, model } from "mongoose";

const RoomSchema = new Schema(
  {
    title: { type: String, required: true },
    max: { type: Number, required: true },
    // owner: { type: String, required: true },
    // password: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

export type Room = InferSchemaType<typeof RoomSchema>;

export const RoomModel = model("room", RoomSchema);
