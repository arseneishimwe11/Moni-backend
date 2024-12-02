export interface RequestWithUser extends Request {
  user: {
    sub: string;
    email: string;
    roles: string[];
    sessionId: string;
  };
  ip: string;
  connection: {
    remoteAddress: string;
  };
}
