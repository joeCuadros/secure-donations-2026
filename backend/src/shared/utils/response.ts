import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { ErrorCode } from '../errors/error-codes.js';

const SECURITY_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export const buildSuccessResponse = <T>(
  statusCode: number,
  data: T
): APIGatewayProxyResultV2 => {
  return {
    statusCode,
    headers: SECURITY_HEADERS,
    body: JSON.stringify(data),
  };
};

export const buildErrorResponse = (
  statusCode: number,
  code: ErrorCode,
  message: string,
  requestId: string
): APIGatewayProxyResultV2 => {
  return {
    statusCode,
    headers: SECURITY_HEADERS,
    body: JSON.stringify({
      code,
      message,
      requestId,
    }),
  };
};