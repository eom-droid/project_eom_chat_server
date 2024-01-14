import * as Crypto from "crypto";

// 암복호화 관련해서는 소스는 긁어 왔고 추후 공부 필요
// https://johnmarc.tistory.com/47
export class EncryptUtils {
  static secretKey: string = process.env.AES_SECRET_KEY!;
  static secretIv: string = process.env.AES_VI_KEY!;
  /**
   * AES Algorithm Based Data Encrypt Function
   * @param secretKey -  Encrypt Key
   * @param plainText - The Data Of To Be Encrypt
   */
  static encryptWithAES256 = (plainText: string): string => {
    const secretKeyToByteArray: Buffer = Buffer.from(this.secretKey, "utf8");
    const ivParameter: Buffer = Buffer.from(this.secretKey.slice(0, 16));
    const cipher: Crypto.Cipher = Crypto.createCipheriv(
      "aes-256-cbc",
      secretKeyToByteArray,
      ivParameter
    );
    let encryptedValue: string = cipher.update(plainText, "utf8", "base64");
    encryptedValue += cipher.final("base64");
    return encryptedValue;
  };

  /**
   * AES Algorithms Based Data Decrypt Function
   * @param secretKey - Decrypt Key
   * @param encryptedText - The Data To Decrypted
   */
  static decryptWithAES256 = (encryptedText: string): string => {
    const secretKeyToBufferArray: Buffer = Buffer.from(this.secretKey, "utf8");
    const ivParameter: Buffer = Buffer.from(this.secretKey.slice(0, 16));
    const cipher: Crypto.Decipher = Crypto.createDecipheriv(
      "aes-256-cbc",
      secretKeyToBufferArray,
      ivParameter
    );
    let decryptedValue: string = cipher.update(encryptedText, "base64", "utf8");
    decryptedValue += cipher.final("utf8");
    return decryptedValue;
  };
}
