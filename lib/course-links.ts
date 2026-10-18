/** Split CS349 / ECE457C into subject + catalog number. */
export function splitCourseCode(code: string): { subject: string; number: string } | null {
  const m = code.toUpperCase().match(/^([A-Z]+)(\d+[A-Z]*)$/);
  if (!m) return null;
  return { subject: m[1], number: m[2] };
}

export function uwflowUrl(code: string): string {
  return `https://uwflow.com/course/${code.toUpperCase()}`;
}

/** Undergraduate Academic Calendar entry via UW's course router. */
export function academicCalendarUrl(code: string): string | null {
  const parts = splitCourseCode(code);
  if (!parts) return null;
  return `https://acal.fast.uwaterloo.ca/course/current/${parts.subject}/${parts.number}`;
}
