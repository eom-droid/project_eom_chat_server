export class CustomWSErrorModel extends Error {
  status: number = 500;

  constructor({ message, status }: { message: string; status: number }) {
    super(message);
    this.status = status;
  }

  static fromError(error: Error) {
    return new CustomWSErrorModel({
      message: error.message,
      status: 500,
    });
  }
}
