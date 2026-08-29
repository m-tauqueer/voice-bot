export const ROUTES = {
  components: "/components",
  dashboard: "/dashboard",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];
