import registry from "../data/verified-resource-promotions.json" with { type: "json" };
import {
  VERIFIED_PROMOTION_REGISTRY_CONTRACT,
  VERIFICATION_PROMOTION_VERSION,
  type VerifiedResourcePromotion,
} from "./verification-promotions.ts";

export type { VerifiedResourcePromotion } from "./verification-promotions.ts";

if (registry.contract !== VERIFIED_PROMOTION_REGISTRY_CONTRACT) {
  throw new Error(
    `Unexpected verified promotion registry contract: ${registry.contract}.`,
  );
}
if (registry.version !== VERIFICATION_PROMOTION_VERSION) {
  throw new Error(
    `Unexpected verified promotion registry version: ${registry.version}.`,
  );
}

const promotions = registry.promotions as VerifiedResourcePromotion[];
const promotionsByIdentifier = new Map<string, VerifiedResourcePromotion>();

for (const promotion of promotions) {
  if (
    promotionsByIdentifier.has(promotion.resourceId) ||
    promotionsByIdentifier.has(promotion.resourceSlug)
  ) {
    throw new Error(
      `Duplicate verified promotion identity: ${promotion.resourceId}/${promotion.resourceSlug}.`,
    );
  }
  promotionsByIdentifier.set(promotion.resourceId, promotion);
  promotionsByIdentifier.set(promotion.resourceSlug, promotion);
}

export function getAllVerifiedPromotions(): readonly VerifiedResourcePromotion[] {
  return promotions;
}

export function getVerifiedPromotion(
  resourceIdOrSlug: string,
): VerifiedResourcePromotion | null {
  return promotionsByIdentifier.get(resourceIdOrSlug.trim()) ?? null;
}
