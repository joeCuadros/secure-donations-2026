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
  pk: string;
  recordId: string;
  payloadHash: string;
  donationId: string;
  responseStatus: number;
  responseBody: string;
  expiresAt: number;
}