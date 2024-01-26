export class Meta {
  count: number;
  hasMore: boolean;

  constructor({ count, hasMore }: { count: number; hasMore: boolean }) {
    this.count = count;
    this.hasMore = hasMore;
  }
}

export class PaginateResModel<T> {
  meta: { count: number; hasMore: boolean };
  data: T[];

  constructor({
    meta,
    data,
  }: {
    meta: { count: number; hasMore: boolean };
    data: T[];
  }) {
    this.meta = meta;
    this.data = data;
  }

  toJson() {
    return {
      meta: this.meta,
      data: this.data,
    };
  }
}
