/**
 * Hand-rolled response-shape validators. Zero deps on purpose — the
 * conformance suite should run anywhere with just Node and not pull in
 * a schema library.
 *
 * Each validator returns either `{ ok: true }` or
 * `{ ok: false, reason: '<human-readable explanation>' }`.
 */

export type ValidationResult = { ok: true } | { ok: false; reason: string };

const MEMORY_TYPES = new Set(['episodic', 'semantic', 'procedural', 'self_model', 'introspective']);
const HEX64 = /^[a-f0-9]{64}$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function field(obj: Record<string, unknown>, name: string, validator: (v: unknown) => boolean, type: string): ValidationResult {
  if (!(name in obj)) return { ok: false, reason: `missing field: ${name}` };
  if (!validator(obj[name])) return { ok: false, reason: `${name} must be ${type}, got ${typeof obj[name]}` };
  return { ok: true };
}

function optionalField(obj: Record<string, unknown>, name: string, validator: (v: unknown) => boolean, type: string): ValidationResult {
  if (!(name in obj) || obj[name] === null || obj[name] === undefined) return { ok: true };
  if (!validator(obj[name])) return { ok: false, reason: `${name} must be ${type} or null, got ${typeof obj[name]}` };
  return { ok: true };
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);

export function validateAttestation(obj: unknown): ValidationResult {
  if (!isObject(obj)) return { ok: false, reason: 'attestation must be an object' };
  for (const check of [
    field(obj, 'chain_id', isString, 'string'),
    field(obj, 'asset_id', isString, 'string'),
    field(obj, 'content_hash', isString, 'string'),
    field(obj, 'tx_sig', isString, 'string'),
    field(obj, 'verifier_url', isString, 'string'),
    optionalField(obj, 'tree_address', isString, 'string'),
    optionalField(obj, 'leaf_index', isNumber, 'number'),
  ]) {
    if (!check.ok) return check;
  }
  // content_hash should be a sha256 hex string for canonical impls
  const ch = obj.content_hash as string;
  if (ch.startsWith('sha256:')) {
    if (!HEX64.test(ch.slice(7))) return { ok: false, reason: 'content_hash sha256 hex must be 64 chars' };
  } else if (!HEX64.test(ch)) {
    return { ok: false, reason: 'content_hash should be 64-char hex or "sha256:<hex>"' };
  }
  return { ok: true };
}

export function validateMemory(obj: unknown): ValidationResult {
  if (!isObject(obj)) return { ok: false, reason: 'memory must be an object' };
  for (const check of [
    field(obj, 'id', isString, 'string'),
    field(obj, 'type', (v) => typeof v === 'string' && MEMORY_TYPES.has(v), `one of ${[...MEMORY_TYPES].join('|')}`),
    field(obj, 'content', isString, 'string'),
    optionalField(obj, 'owner', isString, 'string'),
    field(obj, 'created_at', isString, 'ISO-8601 string'),
    field(obj, 'tags', isStringArray, 'string[]'),
  ]) {
    if (!check.ok) return check;
  }
  // attestation may be null or an Attestation object
  const att = obj.attestation;
  if (att !== null && att !== undefined) {
    const r = validateAttestation(att);
    if (!r.ok) return { ok: false, reason: `attestation: ${r.reason}` };
  }
  return { ok: true };
}

export function validateDiscoverResponse(obj: unknown): ValidationResult {
  if (!isObject(obj)) return { ok: false, reason: 'must be an object' };
  for (const check of [
    field(obj, 'count', isNumber, 'number'),
    field(obj, 'memories', (v): v is unknown[] => Array.isArray(v), 'array'),
  ]) {
    if (!check.ok) return check;
  }
  const arr = obj.memories as unknown[];
  for (let i = 0; i < arr.length; i++) {
    const r = validateMemory(arr[i]);
    if (!r.ok) return { ok: false, reason: `memories[${i}]: ${r.reason}` };
  }
  // count should match memories.length (or be ≥, for paginated responses)
  if ((obj.count as number) < arr.length) {
    return { ok: false, reason: `count (${obj.count}) < memories.length (${arr.length})` };
  }
  return { ok: true };
}

export function validateVerifyResponse(obj: unknown): ValidationResult {
  if (!isObject(obj)) return { ok: false, reason: 'must be an object' };
  for (const check of [
    field(obj, 'id', isString, 'string'),
    field(obj, 'verified', isBoolean, 'boolean'),
    field(obj, 'reason', isString, 'string'),
  ]) {
    if (!check.ok) return check;
  }
  const reason = obj.reason as string;
  const validReasons = new Set(['verified', 'not_committed', 'drift_detected', 'revoked']);
  if (!validReasons.has(reason)) {
    return { ok: false, reason: `reason must be one of ${[...validReasons].join('|')}, got ${reason}` };
  }
  // If verified=true, reason must be 'verified'; if verified=false, must not be 'verified'.
  const verified = obj.verified as boolean;
  if (verified && reason !== 'verified') return { ok: false, reason: `verified=true but reason='${reason}' (expected 'verified')` };
  if (!verified && reason === 'verified') return { ok: false, reason: `reason='verified' but verified=false` };
  return { ok: true };
}

export function validatePackPreviewResponse(obj: unknown): ValidationResult {
  if (!isObject(obj)) return { ok: false, reason: 'must be an object' };
  if (!isObject(obj.pack)) return { ok: false, reason: 'pack must be an object' };
  if (!Array.isArray(obj.revealed)) return { ok: false, reason: 'revealed must be an array' };
  for (const check of [
    field(obj as Record<string, unknown>, 'revealed_count', isNumber, 'number'),
    field(obj as Record<string, unknown>, 'unrevealed_count', isNumber, 'number'),
  ]) {
    if (!check.ok) return check;
  }
  for (let i = 0; i < (obj.revealed as unknown[]).length; i++) {
    const entry = (obj.revealed as unknown[])[i];
    if (!isObject(entry)) return { ok: false, reason: `revealed[${i}] not object` };
    if (typeof entry.content_hash !== 'string') return { ok: false, reason: `revealed[${i}].content_hash missing` };
    if (typeof entry.leaf_index !== 'number') return { ok: false, reason: `revealed[${i}].leaf_index missing` };
    if (!isObject(entry.proof)) return { ok: false, reason: `revealed[${i}].proof missing` };
    if (!Array.isArray((entry.proof as Record<string, unknown>).siblings)) {
      return { ok: false, reason: `revealed[${i}].proof.siblings must be an array` };
    }
  }
  return { ok: true };
}

export function validateErrorResponse(obj: unknown): ValidationResult {
  if (!isObject(obj)) return { ok: false, reason: 'must be an object' };
  return field(obj, 'error', isString, 'string');
}
