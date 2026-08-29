export const ROUTES = {
  components: "/components",
  dashboard: "/dashboard",
  admin: "/admin",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];
