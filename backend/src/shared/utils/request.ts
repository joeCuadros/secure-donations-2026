import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { AppError } from '../errors/app-error.js';

/**
 * Interpreta el cuerpo JSON de la solicitud. Un cuerpo ausente equivale a `{}` y uno malformado
 * produce un 400 uniforme (nunca un 500).
 */
export const parseJsonBody = (event: APIGatewayProxyEventV2): unknown => {
  if (!event.body) return {};

  try {
    const text = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;
    return JSON.parse(text);
  } catch {
    throw AppError.badRequest('El cuerpo de la solicitud no es un JSON válido.');
  }
};
