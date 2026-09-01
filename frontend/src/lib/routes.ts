export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  dashboardConversations: "/dashboard/conversations",
  dashboardPeople: "/dashboard/people",
  dashboardPersona: "/dashboard/persona",
  admin: "/admin",
  chat: "/chat",
  voice: "/voice",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];
export type RouteId = keyof typeof ROUTES;

export const PRODUCT_ROUTE_IDS = [
  "dashboard",
  "dashboardConversations",
  "dashboardPeople",
  "dashboardPersona",
  "admin",
  "chat",
  "voice",
] as const satisfies readonly RouteId[];

export const PRODUCT_ROUTES: readonly Route[] = PRODUCT_ROUTE_IDS.map(
  (id) => ROUTES[id],
);
