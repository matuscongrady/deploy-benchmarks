export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}
export const notFound = (what: string) => new HttpError(404, `${what} not found`);
export const conflict = (message: string) => new HttpError(409, message);
export const unauthorized = () => new HttpError(401, 'Unauthorized');
