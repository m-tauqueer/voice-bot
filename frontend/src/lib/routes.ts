export const ROUTES = {
  components: "/components",
  dashboard: "/dashboard",
  admin: "/admin",
  chat: "/chat",
  voice: "/voice",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];
