import { X509Certificate } from "crypto";
import { readFileSync } from "fs";
import https from "https";
import path from "path";
import tls from "tls";
import { loadOfferings, saveOfferings } from "./store";

const ca = [
  ...tls.rootCertificates,
  new X509Certificate(readFileSync(path.join(process.cwd(), "data/certs/globalsign-r46.crt"))).toString(),
  new X509Certificate(
    readFileSync(path.join(process.cwd(), "data/certs/globalsign-root-r46.crt")),
  ).toString(),
];

function request(url: string, body?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: body ? "POST" : "GET",
        ca,
        headers: body
          ? {
              "content-type": "application/x-www-form-urlencoded",
              "content-length": Buffer.byteLength(body),
            }
          : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

let postedCache: { at: number; terms: string[] } | null = null;

export async function postedTerms(): Promise<string[]> {
  if (postedCache && Date.now() - postedCache.at < 12 * 60 * 60 * 1000) return postedCache.terms;
  const html = await request("https://classes.uwaterloo.ca/under.html");
  const terms = [...html.matchAll(/<option value="(\d{4})"/gi)].map((m) => m[1]);
  const unique = [...new Set(terms)].sort();
  postedCache = { at: Date.now(), terms: unique };
  return unique;
}

export async function isOffered(term: string, code: string): Promise<boolean> {
  const subject = code.match(/^[A-Z]+/)?.[0] ?? "";
  const number = code.slice(subject.length);
  const body = `level=under&sess=${term}&subject=${subject}&cournum=${number}`;
  const html = await request(
    "https://classes.uwaterloo.ca/cgi-bin/cgiwrap/infocour/salook.pl",
    body,
  );
  return !/no matches/i.test(html);
}

export async function refreshOfferings(codes: string[]) {
  const terms = await postedTerms();
  const book = loadOfferings();
  book.postedTerms = terms;
  const missing: { code: string; term: string }[] = [];
  for (const code of [...new Set(codes)]) {
    book.courses[code] ??= {};
    for (const term of terms) {
      if (book.courses[code][term] == null) missing.push({ code, term });
    }
  }
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (cursor < missing.length) {
        const job = missing[cursor++];
        try {
          book.courses[job.code][job.term] = await isOffered(job.term, job.code);
        } catch {
          /* leave unknown */
        }
      }
    }),
  );
  saveOfferings(book);
  return book;
}
