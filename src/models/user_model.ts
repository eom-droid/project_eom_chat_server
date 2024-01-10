import { InferSchemaType, Schema, model } from "mongoose";
// import { CustomHttpErrorModel } from "./custom_http_error_model";

/**
 * 유저 모델
 */

const UserSchema = new Schema(
  {
    email: { type: String, required: false },
    password: { type: String, required: false },
    nickname: { type: String, required: true },
    birthday: { type: Date, required: false },
    profileImg: { type: String, required: false },
    snsId: { type: String, required: false },
    provider: { type: String, required: false },
    role: { type: Number, required: true },
  },
  { timestamps: true }
);

export type User = InferSchemaType<typeof UserSchema>;

export const UserModel = model("user", UserSchema);

// export const userToUserModel = (user: User) => {
//   try {
//     const result = new UserModel({
//       email: user.email,
//       password: user.password,
//       nickname: user.nickname,
//       birthday: user.birthday,
//       profileImg: user.profileImg,
//       snsId: user.snsId,
//       provider: user.provider,
//       role: user.role,
//     });

//     return result;
//   } catch (error) {
//     console.log(new Date().toISOString() + ": npm log: " + error);

//     throw new CustomHttpErrorModel({
//       message: "입력값이 유효하지 않습니다.",
//       status: 400,
//     });
//   }
// };
