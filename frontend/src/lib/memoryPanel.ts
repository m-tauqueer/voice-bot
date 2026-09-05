export function memoryPanelReloadKey(
  userId: string | undefined,
  status: string,
): string {
  return `${status}:${userId ?? ""}`;
}
