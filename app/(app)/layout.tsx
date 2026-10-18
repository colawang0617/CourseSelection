import { AppShell } from "@/components/shell/AppShell";
import { catalogSize, ensureScenario, loadProfile, runAnalysis } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = loadProfile("me");
  const scenarios = ensureScenario(profile);
  const scenario = scenarios.find((s) => s.id === "plan-a") ?? scenarios[0];
  const activeTermId = profile.terms.find((term) => term.kind === "study" && term.status === "future")?.id;
  const initialAnalysis = await runAnalysis({
    profile,
    placements: scenario.placements,
    pins: scenario.pins,
    activeTermId,
    asOfTermId: activeTermId,
    suggest: false,
  });

  return (
    <AppShell
      profile={profile}
      scenarios={scenarios}
      initialAnalysis={initialAnalysis}
      catalogReady={catalogSize() > 1000}
    >
      {children}
    </AppShell>
  );
}
