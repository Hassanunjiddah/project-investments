export type ListResponse<T> = {
  data: T[];
  count: number;
  fetched: number;
  hasMore: boolean;
};

export type ListParams = {
  skip?: number;
  limit?: number;
};

export type ListRequest<T> = T & {
  skip?: number;
  limit?: number;
};
