// Shared API response types.
export type Response<T> = {
  success: boolean;
  message: string;
  data: T | null;
};
