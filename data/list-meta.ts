/** Display labels and sidebar grouping for catalog lists in Add Course. */

export const LIST_LABELS: Record<string, string> = {
  "te-1": "Technical Elective List 1",
  "te-2": "Technical Elective List 2",
  "te-3": "Technical Elective List 3",
  "ns-1": "Natural science — Mechanics",
  "ns-2": "Natural science — List 2",
  "cse-a": "Complementary studies — List A",
  "cse-c": "Complementary studies — List C",
  comm: "Communication",
  sustainability: "Sustainability",
};

export const LIST_SECTIONS: { section: string; ids: string[] }[] = [
  { section: "Technical electives", ids: ["te-1", "te-2", "te-3"] },
  { section: "Natural science", ids: ["ns-1", "ns-2"] },
  { section: "Complementary studies", ids: ["cse-a", "cse-c"] },
  { section: "Communication", ids: ["comm"] },
  { section: "Other", ids: ["sustainability"] },
];

export function listLabel(id: string): string {
  return LIST_LABELS[id] ?? id;
}
