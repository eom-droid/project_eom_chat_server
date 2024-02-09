export const TokenType = {
  ACCESS: "access",
  REFRESH: "refresh",
} as const;

export type TokenType = (typeof TokenType)[keyof typeof TokenType];

export const RoleType = {
  USER: 0,
  MANAGER: 5,
  ADMIN: 10,
} as const;

export type RoleType = (typeof RoleType)[keyof typeof RoleType];
export const numberToRoleType = (num: number) => {
  switch (num) {
    case 0:
      return RoleType.USER;
    case 5:
      return RoleType.MANAGER;
    case 10:
      return RoleType.ADMIN;
    default:
      return RoleType.USER;
  }
};

export const PAGINATE_COUNT_DEFAULT = 30;

export const USER_ID = "userId";
export const CURRENT_ROOM_ID = "currentRoomId";
