import { apiClient } from "../apiClient";
import type { 
  Donation, 
  CreateDonationRequest, 
  SimulateDonationRequest, 
  DonationListResponse,
  ListDonationsParams
} from "./types";

export const donationsApi = {
  listMyDonations: (params?: ListDonationsParams) => 
    apiClient<DonationListResponse>("/v1/donations/me", { params }),
  
  create: (data: CreateDonationRequest, idempotencyKey: string) =>
    apiClient<Donation>("/v1/donations", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    }),
    
  simulate: (donationId: string, data: SimulateDonationRequest) =>
    apiClient<Donation>(`/v1/donations/${donationId}/simulate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};