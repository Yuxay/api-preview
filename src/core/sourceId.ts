const SOURCE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export function isValidSourceId(value: unknown): value is string {
  return typeof value === 'string' && SOURCE_ID_PATTERN.test(value);
}

export function assertValidSourceId(value: unknown): asserts value is string {
  if (!isValidSourceId(value)) {
    throw new Error('Invalid source id');
  }
}
