import { Types } from "mongoose";
import { PAGINATE_COUNT_DEFAULT } from "../constant/default";
import { CustomHttpErrorModel } from "./custom_http_error_model";

export class PaginateReqModel {
  count: number;
  after: string | undefined;

  constructor({ count, after }: { count?: number; after?: string }) {
    try {
      this.count = count === undefined ? PAGINATE_COUNT_DEFAULT : Number(count);
      this.after = after;
      return this;
    } catch (error) {
      console.log(new Date().toISOString() + ": npm log: " + error);

      throw new CustomHttpErrorModel({
        status: 400,
        message: "잘못된 요청입니다.",
      });
    }
  }
  generateQuery(greaterThan: boolean) {
    const query: any = {};

    if (this.after !== undefined) {
      if (greaterThan) {
        query._id = {
          $gt: new Types.ObjectId(this.after),
        };
      } else {
        query._id = {
          $lt: new Types.ObjectId(this.after),
        };
      }
    }

    return query;
  }
}

export class DiaryPaginateReqModel extends PaginateReqModel {
  category: string | undefined;

  constructor({
    count,
    after,
    category,
  }: {
    count?: number;
    after?: string;
    category?: string;
  }) {
    super({ count, after });
    this.category = category;
    return this;
  }

  generateQuery() {
    const query = super.generateQuery(false);

    if (this.category !== undefined) {
      query.category = this.category;
    }

    return query;
  }
}
