import { CourseDetail } from "@/components/courses/CourseDetail";

export default async function CoursePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <CourseDetail code={decodeURIComponent(code).replace(/\s+/g, "").toUpperCase()} />;
}
