import { loadRatings, saveRatings } from "./store";
import type { RatingInfo } from "@/engine/types";

const WEEK = 7 * 24 * 60 * 60 * 1000;

function season(termId: number): string {
  const month = termId % 10;
  return month === 1 ? "W" : month === 5 ? "S" : month === 9 ? "F" : "";
}

export async function refreshRatings(codes: string[]) {
  const cache = loadRatings();
  const need = [...new Set(codes.map((c) => c.toLowerCase()))].filter((code) => {
    const hit = cache[code.toUpperCase()];
    return !hit || Date.now() - hit.at > WEEK;
  });
  for (let i = 0; i < need.length; i += 40) {
    const slice = need.slice(i, i + 40);
    const query = {
      query: `query($codes:[String!]){ course(where:{code:{_in:$codes}}){
        code
        rating{ liked easy useful filled_count }
        reviews(limit:3, order_by:{created_at:desc}){ liked course_comment created_at }
        sections{ term_id }
      } }`,
      variables: { codes: slice },
    };
    const res = await fetch("https://uwflow.com/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(query),
    });
    if (!res.ok) continue;
    const json = (await res.json()) as {
      data?: {
        course: {
          code: string;
          rating: { liked: number | null; easy: number | null; useful: number | null; filled_count: number } | null;
          reviews: { liked: number | null; course_comment: string | null; created_at: string }[];
          sections: { term_id: number }[];
        }[];
      };
    };
    for (const course of json.data?.course ?? []) {
      const info: RatingInfo & { at: number; seasons: string[] } = {
        liked: course.rating?.liked ?? null,
        easy: course.rating?.easy ?? null,
        useful: course.rating?.useful ?? null,
        filled: course.rating?.filled_count ?? 0,
        comments: (course.reviews ?? [])
          .filter((r) => r.course_comment)
          .slice(0, 3)
          .map((r) => ({ text: r.course_comment ?? "", liked: r.liked, createdAt: r.created_at })),
        seasons: [...new Set((course.sections ?? []).map((s) => season(s.term_id)).filter(Boolean))],
        at: Date.now(),
      };
      cache[course.code.toUpperCase()] = info;
    }
  }
  saveRatings(cache);
  return cache;
}
