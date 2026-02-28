import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

export type ParsedCliArgs = {
  flags: Set<string>;
  values: Record<string, string | undefined>;
};

export type SeedEntry = {
  seedRank: number;
  seedScore: number;
  title: string;
  year: number | null;
  normalizedName: string;
  slug: string;
};

const rankedLinePattern = /^\s*(\d+)\.\s+(.*?)\s*\|/;
const trailingYearPattern = /\((\d{4})\)\s*$/;

export function getRepoPath(...parts: string[]) {
  return path.resolve(process.cwd(), ...parts);
}

export function parseCliArgs(): ParsedCliArgs {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      reset: { type: "boolean" },
      "dry-run": { type: "boolean" },
      output: { type: "string" },
      format: { type: "string" },
      file: { type: "string" },
      limit: { type: "string" }
    }
  });

  return {
    flags: new Set(
      Object.entries(values)
        .filter(([, value]) => value === true)
        .map(([key]) => key)
        .concat(positionals)
    ),
    values: {
      output: typeof values.output === "string" ? values.output : undefined,
      format: typeof values.format === "string" ? values.format : undefined,
      file: typeof values.file === "string" ? values.file : undefined,
      limit: typeof values.limit === "string" ? values.limit : undefined
    }
  };
}

export function normalizeTitle(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function slugifyTitle(value: string) {
  return normalizeTitle(value).replace(/\s+/g, "-");
}

export async function loadSeedEntries(seedFilePath = getRepoPath("top_1000_popular_games.txt")) {
  const fileContents = await readFile(seedFilePath, "utf8");
  const lines = fileContents.split(/\r?\n/);
  const seedEntries: SeedEntry[] = [];
  const usedSlugs = new Set<string>();

  for (const line of lines) {
    const parsed = parseSeedLine(line);

    if (!parsed) {
      continue;
    }

    let slug = buildBaseSlug(parsed.title, parsed.year);

    if (usedSlugs.has(slug)) {
      slug = `${slug}-${parsed.seedRank}`;
    }

    usedSlugs.add(slug);
    seedEntries.push({
      ...parsed,
      slug
    });
  }

  return seedEntries;
}

export function parseSeedLine(line: string): Omit<SeedEntry, "slug"> | null {
  const rankedMatch = line.match(rankedLinePattern);

  if (!rankedMatch) {
    return null;
  }

  const seedRank = Number.parseInt(rankedMatch[1], 10);
  const rawTitleSegment = rankedMatch[2].trim();
  const trailingYearMatch = rawTitleSegment.match(trailingYearPattern);
  const year = trailingYearMatch ? Number.parseInt(trailingYearMatch[1], 10) : null;
  const title = trailingYearMatch
    ? rawTitleSegment.slice(0, trailingYearMatch.index).trim()
    : rawTitleSegment;

  return {
    seedRank,
    seedScore: Math.max(1, 1001 - seedRank),
    title,
    year,
    normalizedName: normalizeTitle(title)
  };
}

export function buildBaseSlug(title: string, year: number | null) {
  const slug = slugifyTitle(title);
  return year ? `${slug}-${year}` : slug;
}

export function parseLimit(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function writeOutputFile(outputPath: string, contents: string) {
  const absolutePath = path.isAbsolute(outputPath) ? outputPath : getRepoPath(outputPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, "utf8");
  return absolutePath;
}

export function toIsoDate(value: Date) {
  return value.toISOString();
}
