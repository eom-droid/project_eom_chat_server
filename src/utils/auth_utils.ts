import jwt from "jsonwebtoken";
import { TokenType } from "../constant/default";
import { CustomWSErrorModel } from "../models/custom_http_error_model";
import { EncryptUtils } from "./encrypt_utils";

export class customJwtPayload implements jwt.JwtPayload {
  id: string;
  tokenType: string;
  exp?: number | undefined;
  iat?: number | undefined;

  constructor(token: jwt.JwtPayload) {
    this.id = token.id;
    this.tokenType = token.tokenType;
    this.exp = token.exp;
    this.iat = token.iat;
  }
}

export class AuthUtils {
  static verifyAccessToken(token: string): customJwtPayload {
    const payload = this.verifyToken(token);
    if (payload.tokenType !== TokenType.ACCESS) {
      throw new CustomWSErrorModel({
        status: 401,
        message: "Access 토큰이 아닙니다.",
      });
    }
    return payload;
  }

  static verifyToken(token: string): customJwtPayload {
    try {
      const decodedCode = jwt.verify(token, process.env.JWT_SECRET_KEY!);
      const payload = new customJwtPayload(decodedCode as jwt.JwtPayload);
      // 1. 토큰 exp 검증
      if (!payload.exp)
        throw new CustomWSErrorModel({
          status: 401,
          message: "토큰이 만료되었습니다.",
        });
      // 2. 토큰이 만료되었는지 검증
      if (payload.exp < Date.now() / 1000) {
        throw new CustomWSErrorModel({
          status: 401,
          message: "토큰이 만료되었습니다.",
        });
      }
      // payload id 복호화 진행
      payload.id = EncryptUtils.decryptWithAES256(payload.id);
      return payload;
    } catch (error) {
      console.log(error);
      if (error instanceof CustomWSErrorModel) throw error;
      throw new CustomWSErrorModel({
        status: 401,
        message: "토큰이 유효하지 않습니다.",
      });
    }
  }
}
