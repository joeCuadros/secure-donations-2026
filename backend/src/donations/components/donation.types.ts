export type DonationStatus = 'PENDIENTE_SIMULACION' | 'CONFIRMADA_SIMULADA' | 'RECHAZADA_SIMULADA';

export interface DonationItem {
  donationId: string;
  projectId: string;
  donorSub: string;
  amountCents: number;
  currency: 'PEN';
  status: DonationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IdempotencyRecordItem {
  pk: string; // donorSub#createDonation#idempotencyKey
  recordId: string;
  payloadHash: string;
  donationId: string;
  responseStatus: number;
  responseBody: string;
  expiresAt: number; // TTL Epoch seconds
}

export interface CreateDonationInput {
  projectId: string;
  amountCents: number;
  idempotencyKey: string;
}

export interface SimulateDonationInput {
  donationId: string;
  result: 'CONFIRMADA_SIMULADA' | 'RECHAZADA_SIMULADA';
}

export interface DonationResponseDTO {
  donationId: string;
  projectId: string;
  amountCents: number;
  currency: 'PEN';
  status: DonationStatus;
  createdAt: string;
  updatedAt?: string;
}