declare namespace Express {
  interface Request {
    user?: {
      username: string;
      email: string;
      id: string;
    };
  }
}