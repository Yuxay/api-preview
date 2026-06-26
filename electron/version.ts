import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const FALLBACK_VERSION = '0.0.0';

function normalizeVersion(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const match = raw.match(
    /\d+(?:\.\d+){0,3}(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?/,
  );
  return match?.[0] ?? null;
}

function readVersionFromPackageJson(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content) as { version?: unknown };
    return normalizeVersion(parsed.version);
  } catch {
    return null;
  }
}

function getPackageJsonCandidates(): string[] {
  const candidates = [
    path.join(app.getAppPath(), 'package.json'),
    path.join(process.resourcesPath, 'app.asar', 'package.json'),
    path.join(process.resourcesPath, 'app', 'package.json'),
    path.join(process.cwd(), 'package.json'),
  ];

  return [...new Set(candidates)];
}

function compareNumericSegments(a: string, b: string): number {
  const aSegments = a
    .split('.')
    .map((segment) => Number.parseInt(segment, 10) || 0);
  const bSegments = b
    .split('.')
    .map((segment) => Number.parseInt(segment, 10) || 0);
  const length = Math.max(aSegments.length, bSegments.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (aSegments[index] ?? 0) - (bSegments[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }

  return 0;
}

function comparePrerelease(
  a: string | undefined,
  b: string | undefined,
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const aParts = a.split('.');
  const bParts = b.split('.');
  const length = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < length; index += 1) {
    const aPart = aParts[index];
    const bPart = bParts[index];

    if (aPart === undefined) return -1;
    if (bPart === undefined) return 1;

    const aNumber = /^\d+$/.test(aPart) ? Number.parseInt(aPart, 10) : null;
    const bNumber = /^\d+$/.test(bPart) ? Number.parseInt(bPart, 10) : null;

    if (aNumber !== null && bNumber !== null && aNumber !== bNumber) {
      return aNumber > bNumber ? 1 : -1;
    }

    if (aNumber !== null && bNumber === null) return -1;
    if (aNumber === null && bNumber !== null) return 1;

    if (aPart !== bPart) return aPart > bPart ? 1 : -1;
  }

  return 0;
}

export function getCurrentAppVersion(): string {
  const appVersion = normalizeVersion(app.getVersion());
  if (appVersion) return appVersion;

  for (const candidate of getPackageJsonCandidates()) {
    const version = readVersionFromPackageJson(candidate);
    if (version) return version;
  }

  return FALLBACK_VERSION;
}

export function compareAppVersions(a: string, b: string): number {
  const normalizedA = normalizeVersion(a) ?? FALLBACK_VERSION;
  const normalizedB = normalizeVersion(b) ?? FALLBACK_VERSION;

  const [aCore, aPrerelease] = normalizedA.split('-', 2);
  const [bCore, bPrerelease] = normalizedB.split('-', 2);

  const coreDiff = compareNumericSegments(aCore, bCore);
  if (coreDiff !== 0) return coreDiff;

  return comparePrerelease(aPrerelease, bPrerelease);
}

export function normalizeAppVersion(value: unknown): string | null {
  return normalizeVersion(value);
}
