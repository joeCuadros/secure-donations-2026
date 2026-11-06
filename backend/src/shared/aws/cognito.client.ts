import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { env } from '../config/env.js';

export const cognitoClient = new CognitoIdentityProviderClient({
  region: env.AWS_REGION,
});