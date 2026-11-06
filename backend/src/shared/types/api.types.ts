import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

export interface ApiResponseHeaders {
  [key: string]: string | boolean | number;
}

export interface ApiResponseBody<T = unknown> {
  data?: T;
  code?: string;
  message?: string;
  requestId?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextToken: string | null;
}

export interface AuthenticatedUser {
  sub: string;
  email?: string;
  groups: string[];
  scopes: string[];
  username?: string;
}

export type CustomAPIGatewayEvent = APIGatewayProxyEventV2;
export type CustomAPIGatewayResult = APIGatewayProxyResultV2;