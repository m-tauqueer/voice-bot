export function emptySessionList(rangeId: string): {
  range: string;
  sessions: [];
  next_cursor: null;
} {
  return { range: rangeId, sessions: [], next_cursor: null };
}

export function sessionListScope(args: {
  viewerUserId: string;
  ownerView: boolean;
  filterUserId?: string | null;
}): { scopeUserId: string | null; userId: string | null } {
  if (args.ownerView) {
    return { scopeUserId: null, userId: args.filterUserId ?? null };
  }
  return { scopeUserId: args.viewerUserId, userId: null };
}

export function sessionDetailScope(
  ownerView: boolean,
  viewerUserId: string,
): string | null {
  return ownerView ? null : viewerUserId;
}
