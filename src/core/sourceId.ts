const SOURCE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export function assertValidSourceId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !SOURCE_ID_PATTERN.test(value)) {
    throw new Error('Invalid source id');
  }
}
