export function requiredVite(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function requiredViteInt(name: keyof ImportMetaEnv): number {
  const parsed = Number(requiredVite(name));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function requiredViteBool(name: keyof ImportMetaEnv): boolean {
  const raw = requiredVite(name);
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  throw new Error(`${name} must be true or false`);
}
