const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const isPlainObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const assertIdentifier = (value: string, label = "identifier") => {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
};

export const quoteIdentifier = (value: string) =>
  `\`${assertIdentifier(value)}\``;

export const assertKnownIdentifier = (
  value: string,
  knownValues: Set<string>,
  label = "identifier",
) => {
  assertIdentifier(value, label);
  if (!knownValues.has(value)) {
    throw new Error(`Unknown ${label}: ${value}`);
  }
  return value;
};

export const numberOrUndefined = (value: unknown, label: string) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return numberValue;
};
