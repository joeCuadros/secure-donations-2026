export interface Donation {
  donationId: string;
  projectId: string;
  donorSub: string;
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  createdAt: string;
}

export interface CreateDonationRequest {
  projectId: string;
  amount: number;
}

export interface SimulateDonationRequest {
  status: "COMPLETED" | "FAILED";
}

export interface DonationListResponse {
  items: Donation[];
  nextToken: string | null;
}

export type ListDonationsParams = {
  nextToken?: string;
  limit?: number;
};