"use client";

import type { Analysis, Profile, Scenario } from "@/engine/types";
import { PlannerProvider } from "@/components/PlannerProvider";
import { RequirementSheet } from "@/components/workspace/RequirementSheet";
import { CommandSearch } from "./CommandSearch";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";

export function AppShell({
  profile,
  scenarios,
  initialAnalysis,
  catalogReady,
  children,
}: {
  profile: Profile;
  scenarios: Scenario[];
  initialAnalysis: Analysis;
  catalogReady: boolean;
  children: React.ReactNode;
}) {
  return (
    <PlannerProvider
      profile={profile}
      initialScenarios={scenarios}
      initialAnalysis={initialAnalysis}
      catalogReady={catalogReady}
    >
      <div className="flex h-screen flex-col text-[13px] text-[#1b2130]">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        <StatusBar />
      </div>
      <RequirementSheet />
      <CommandSearch />
    </PlannerProvider>
  );
}
