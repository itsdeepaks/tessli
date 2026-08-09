import { HomeTaskEntry } from "@/components/home-task-entry/home-task-entry";
import { ExploreHero } from "@/components/explore-hero/explore-hero";
import { getPublishedCollections } from "@/lib/collections";

export const metadata = {
  title: "Tessli — design research for people and agents",
  description:
    "Start with a design task, choose relevant sources, and carry the useful decisions into your build.",
};

export default function HomePage() {
  return (
    <main id="main-content">
      <ExploreHero />
      <HomeTaskEntry collections={getPublishedCollections().slice(0, 3)} />
    </main>
  );
}
