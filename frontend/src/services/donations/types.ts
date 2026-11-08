export type DonationStatus =
  | "PENDIENTE_SIMULACION"
  | "CONFIRMADA_SIMULADA"
  | "RECHAZADA_SIMULADA";

export interface Donation {
  donationId: string;
  projectId: string;
  amountCents: number;
  currency: "PEN";
  status: DonationStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateDonationRequest {
  projectId: string;
  amountCents: number;
}

export interface SimulateDonationRequest {
  result: "CONFIRMADA_SIMULADA" | "RECHAZADA_SIMULADA";
}

export interface SimulateDonationResponse {
  donationId: string;
  status: DonationStatus;
  updatedAt: string;
}

export interface DonationListResponse {
  items: Donation[];
  nextToken: string | null;
}

export type ListDonationsParams = {
  nextToken?: string;
  limit?: number;
};
