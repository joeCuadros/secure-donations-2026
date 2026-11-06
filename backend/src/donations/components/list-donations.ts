import { donationRepository } from './donation.repository.js';
import type { DonationResponseDTO } from './donation.types.js';

export const listDonationsByDonor = async (
  donorSub: string,
  limit: number = 20,
  nextToken?: string
): Promise<{ items: DonationResponseDTO[]; nextToken: string | null }> => {
  const { items, nextToken: newNextToken } = await donationRepository.listByDonor(
    donorSub,
    limit,
    nextToken
  );

  const formattedItems: DonationResponseDTO[] = items.map((d) => ({
    donationId: d.donationId,
    projectId: d.projectId,
    amountCents: d.amountCents,
    currency: d.currency,
    status: d.status,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));

  return {
    items: formattedItems,
    nextToken: newNextToken,
  };
};