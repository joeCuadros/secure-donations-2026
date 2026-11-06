export interface AuthenticatedUser {
  sub: string;
  email?: string;
  groups: string[];
  scopes: string[];
  username?: string;
}