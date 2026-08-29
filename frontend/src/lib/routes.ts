export const ROUTES = {
  components: "/components",
  dashboard: "/dashboard",
  admin: "/admin",
  chat: "/chat",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];
