import { RoleType } from "../constant/default";
import { User, UserModel } from "../models/user_model";
import { Types } from "mongoose";

export const searchSnsUser = async ({
  snsId,
  provider,
}: {
  snsId?: string;
  provider?: string;
}) => {
  return await searchUser({ snsId, provider });
};

export const checkUserExist = async (userId: string) => {
  return await UserModel.exists({ _id: new Types.ObjectId(userId) });
};

export const searchUserById = async (id: string) => {
  return await searchUser({ _id: new Types.ObjectId(id) });
};

export const searchUserByEmail = async (email: string) => {
  return await searchUser({ email });
};

export const searchUsersByRole = async (role: RoleType) => {
  return await searchUsers({ role });
};

const searchUsers = async (searchObj: Object) => {
  try {
    return await UserModel.find(searchObj);
  } catch (error) {
    throw error;
  }
};

const searchUser = async (searchObj: Object) => {
  try {
    return await UserModel.findOne(searchObj);
  } catch (error) {
    throw error;
  }
};
