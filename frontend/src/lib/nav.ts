import { MEMORY_ICONS } from "./memory-icons";
import { requiredVite } from "./env";
import { matchPath } from "./router";
import { ROUTES, type RouteId } from "./routes";

export type NavItem = {
  id: string;
  label: string;
  icon: string;
  to: string;
  roles: readonly string[];
};

const ROUTE_IDS = new Set<string>(Object.keys(ROUTES));

function parseRoles(raw: string, allowed: Set<string>): string[] {
  const roles = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (roles.length === 0 || roles.some((role) => !allowed.has(role))) {
    throw new Error(`Invalid nav roles: ${raw}`);
  }
  return roles;
}

export function parseNavItems(
  raw: string,
  allowedRoles: Set<string>,
): NavItem[] {
  const items: NavItem[] = [];
  const seen = new Set<string>();
  for (const entry of raw.split(/[;\n]+/)) {
    const trimmed = entry.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const parts = trimmed.split("|").map((part) => part.trim());
    if (parts.length !== 5) {
      throw new Error(`Invalid VITE_NAV_ITEMS entry: ${trimmed}`);
    }
    const [id, label, icon, routeId, roleRaw] = parts;
    if (!id || !label || !icon || !routeId) {
      throw new Error(`Invalid VITE_NAV_ITEMS entry: ${trimmed}`);
    }
    if (seen.has(id)) {
      throw new Error(`Duplicate nav id: ${id}`);
    }
    if (
      !ROUTE_IDS.has(routeId) ||
      routeId === "admin" ||
      routeId === "home"
    ) {
      throw new Error(`Unknown nav route: ${routeId}`);
    }
    if (!(icon in MEMORY_ICONS)) {
      throw new Error(`Unknown nav icon: ${icon}`);
    }
    seen.add(id);
    items.push({
      id,
      label,
      icon,
      to: ROUTES[routeId as RouteId],
      roles: parseRoles(roleRaw, allowedRoles),
    });
  }
  if (items.length === 0) {
    throw new Error("VITE_NAV_ITEMS is empty");
  }
  return items;
}

export type NavConfig = {
  appName: string;
  ownerRole: string;
  memberRole: string;
  items: NavItem[];
  signOutLabel: string;
  loadingLabel: string;
  continueLabel: string;
  notOwnerMessage: string;
  signIn: {
    chatTitle: string;
    chatBody: string;
    voiceTitle: string;
    voiceBody: string;
    personaTitle: string;
    personaBody: string;
    appTitle: string;
    appBody: string;
  };
};

let cached: NavConfig | null = null;

export function loadNavConfig(): NavConfig {
  if (cached) {
    return cached;
  }
  const ownerRole = requiredVite("VITE_NAV_ROLE_OWNER");
  const memberRole = requiredVite("VITE_NAV_ROLE_MEMBER");
  if (ownerRole === memberRole) {
    throw new Error("VITE_NAV_ROLE_OWNER and VITE_NAV_ROLE_MEMBER must differ");
  }
  const items = parseNavItems(
    requiredVite("VITE_NAV_ITEMS"),
    new Set([ownerRole, memberRole]),
  );
  const ownerItems = items.filter((item) => item.roles.includes(ownerRole));
  const memberItems = items.filter((item) => item.roles.includes(memberRole));
  if (ownerItems.length === 0 || memberItems.length === 0) {
    throw new Error("VITE_NAV_ITEMS must include items for each role");
  }
  cached = {
    appName: requiredVite("VITE_APP_NAME"),
    ownerRole,
    memberRole,
    items,
    signOutLabel: requiredVite("VITE_SIGNOUT_LABEL"),
    loadingLabel: requiredVite("VITE_LOADING_LABEL"),
    continueLabel: requiredVite("VITE_SIGNIN_CONTINUE"),
    notOwnerMessage: requiredVite("VITE_NOT_OWNER_MESSAGE"),
    signIn: {
      chatTitle: requiredVite("VITE_SIGNIN_TITLE_CHAT"),
      chatBody: requiredVite("VITE_SIGNIN_BODY_CHAT"),
      voiceTitle: requiredVite("VITE_SIGNIN_TITLE_VOICE"),
      voiceBody: requiredVite("VITE_SIGNIN_BODY_VOICE"),
      personaTitle: requiredVite("VITE_SIGNIN_TITLE_PERSONA"),
      personaBody: requiredVite("VITE_SIGNIN_BODY_PERSONA"),
      appTitle: requiredVite("VITE_SIGNIN_TITLE_APP"),
      appBody: requiredVite("VITE_SIGNIN_BODY_APP"),
    },
  };
  return cached;
}

export function visibleNav(items: NavItem[], owner: boolean): NavItem[] {
  const { ownerRole, memberRole } = loadNavConfig();
  const role = owner ? ownerRole : memberRole;
  return items.filter((item) => item.roles.includes(role));
}

export function navIdForPath(items: NavItem[], path: string): string {
  return items.find((item) => matchPath(path, item.to))?.id ?? items[0]?.id ?? "";
}

const OWNER_TAB_ROUTES = [
  ROUTES.dashboardConversations,
  ROUTES.dashboardPeople,
  ROUTES.dashboardPersona,
  ROUTES.admin,
] as const;

export function pathNeedsOwner(items: NavItem[], path: string): boolean {
  const { ownerRole, memberRole } = loadNavConfig();
  const hits = items.filter((item) => matchPath(path, item.to));
  if (hits.length > 0) {
    return hits.every(
      (item) =>
        item.roles.includes(ownerRole) && !item.roles.includes(memberRole),
    );
  }
  return OWNER_TAB_ROUTES.some((route) => matchPath(path, route));
}

export function signInCopy(path: string): { title: string; body: string } {
  const { signIn } = loadNavConfig();
  if (matchPath(path, ROUTES.chat)) {
    return { title: signIn.chatTitle, body: signIn.chatBody };
  }
  if (matchPath(path, ROUTES.voice)) {
    return { title: signIn.voiceTitle, body: signIn.voiceBody };
  }
  if (
    matchPath(path, ROUTES.dashboardPersona) ||
    matchPath(path, ROUTES.admin)
  ) {
    return { title: signIn.personaTitle, body: signIn.personaBody };
  }
  return { title: signIn.appTitle, body: signIn.appBody };
}
