import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { ErrorCode } from '../errors/error-codes.js';

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export const buildJsonResponse = (
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {}
): APIGatewayProxyResultV2 => {
  return {
    statusCode,
    headers: {
      ...COMMON_HEADERS,
      ...headers,
    },
    body: JSON.stringify(body),
  };
};

export const buildSuccessResponse = <T>(
  statusCode: number,
  data: T,
  headers: Record<string, string> = {}
): APIGatewayProxyResultV2 => {
  return buildJsonResponse(statusCode, data, headers);
};

export const buildErrorResponse = (
  statusCode: number,
  code: ErrorCode,
  message: string,
  requestId: string
): APIGatewayProxyResultV2 => {
  return buildJsonResponse(statusCode, {
    code,
    message,
    requestId,
  });
};