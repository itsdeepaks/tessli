import batch13 from "../data/intelligence-profile-batches/1.3.json" with { type: "json" };
import batch14 from "../data/intelligence-profile-batches/1.4.json" with { type: "json" };
import p21stDev from "../data/intelligence-profiles/21st-dev.json" with { type: "json" };
import pAntDesign from "../data/intelligence-profiles/ant-design.json" with { type: "json" };
import pCoolors from "../data/intelligence-profiles/coolors.json" with { type: "json" };
import pFontshare from "../data/intelligence-profiles/fontshare.json" with { type: "json" };
import pGodly from "../data/intelligence-profiles/godly.json" with { type: "json" };
import pLandingLove from "../data/intelligence-profiles/landing-love.json" with { type: "json" };
import pLandingfolio from "../data/intelligence-profiles/landingfolio.json" with { type: "json" };
import pLapaNinja from "../data/intelligence-profiles/lapa-ninja.json" with { type: "json" };
import pMobbin from "../data/intelligence-profiles/mobbin.json" with { type: "json" };
import pMotion from "../data/intelligence-profiles/motion.json" with { type: "json" };
import pNicelydone from "../data/intelligence-profiles/nicelydone.json" with { type: "json" };
import pPageFlows from "../data/intelligence-profiles/page-flows.json" with { type: "json" };
import pRefero from "../data/intelligence-profiles/refero.json" with { type: "json" };
import pRelume from "../data/intelligence-profiles/relume.json" with { type: "json" };
import pShadcnUi from "../data/intelligence-profiles/shadcn-ui.json" with { type: "json" };
import pSiteinspire from "../data/intelligence-profiles/siteinspire.json" with { type: "json" };
import pThreeJs from "../data/intelligence-profiles/three-js.json" with { type: "json" };
import pTypewolf from "../data/intelligence-profiles/typewolf.json" with { type: "json" };
import pV0 from "../data/intelligence-profiles/v0.json" with { type: "json" };
import pWhoCanUse from "../data/intelligence-profiles/who-can-use.json" with { type: "json" };

export interface AgentInterface {
  type: string;
  transport?: string;
  endpoint?: string;
  status?: string;
}

export interface ResourceIntelligenceProfile {
  profileVersion: number;
  resourceId: string;
  status: string;
  verifiedAt: string;
  summary: string;
  capabilities: string[];
  contentObjects: string[];
  platforms: string[];
  frameworks: string[];
  designTools: string[];
  deliveryFormats: string[];
  integrationMethods: string[];
  agentInterfaces: AgentInterface[];
  discovery: {
    textSearch: boolean;
    semanticSearch?: string;
    facets: string[];
  };
  workflowFit: string[];
  limitations: string[];
  governance: {
    defaultPersistence: string;
    assetRedistribution: string;
    sourceAttribution: string;
    userCredentialRequired: boolean;
    termsReviewRequired: boolean;
    notes?: string[];
  };
  evidence: Array<{
    claim: string;
    sourceUrl: string;
    sourceType: string;
    verifiedAt: string;
    confidence?: string;
  }>;
  humanReview?: {
    status: "completed";
    reviewerId: string;
    reviewedAt: string;
    verificationRecordPath: string;
  };
}

const rawProfiles: ResourceIntelligenceProfile[] = [
  p21stDev as ResourceIntelligenceProfile,
  pAntDesign as ResourceIntelligenceProfile,
  pCoolors as ResourceIntelligenceProfile,
  pFontshare as ResourceIntelligenceProfile,
  pGodly as ResourceIntelligenceProfile,
  pLandingLove as ResourceIntelligenceProfile,
  pLandingfolio as ResourceIntelligenceProfile,
  pLapaNinja as ResourceIntelligenceProfile,
  pMobbin as ResourceIntelligenceProfile,
  pMotion as ResourceIntelligenceProfile,
  pNicelydone as ResourceIntelligenceProfile,
  pPageFlows as ResourceIntelligenceProfile,
  pRefero as ResourceIntelligenceProfile,
  pRelume as ResourceIntelligenceProfile,
  pShadcnUi as ResourceIntelligenceProfile,
  pSiteinspire as ResourceIntelligenceProfile,
  pThreeJs as ResourceIntelligenceProfile,
  pTypewolf as ResourceIntelligenceProfile,
  pV0 as ResourceIntelligenceProfile,
  pWhoCanUse as ResourceIntelligenceProfile,
  ...(batch13.profiles as unknown as ResourceIntelligenceProfile[]),
  ...(batch14.profiles as unknown as ResourceIntelligenceProfile[]),
];

const profilesByResourceId = new Map<string, ResourceIntelligenceProfile>();

for (const profile of rawProfiles) {
  if (profilesByResourceId.has(profile.resourceId)) {
    throw new Error(
      `Duplicate intelligence profile resourceId: ${profile.resourceId}`,
    );
  }
  profilesByResourceId.set(profile.resourceId, profile);
}

export function getIntelligenceProfile(
  resourceIdOrSlug: string,
): ResourceIntelligenceProfile | null {
  return profilesByResourceId.get(resourceIdOrSlug) ?? null;
}

export function getIntelligenceBadge(
  profile: ResourceIntelligenceProfile,
): string | null {
  const hasMcp = profile.agentInterfaces.some((ai) => ai.type === "mcp");
  if (hasMcp) return "MCP Enabled";
  if (profile.capabilities.includes("generative-ui-builder"))
    return "AI Builder";
  if (profile.integrationMethods.includes("cli")) return "CLI Tool";
  if (profile.capabilities.includes("component-library"))
    return "Component System";
  if (profile.capabilities.includes("landing-page-inspiration"))
    return "Curated Showcase";
  return null;
}

export function getAllIntelligenceProfiles(): readonly ResourceIntelligenceProfile[] {
  return rawProfiles;
}
