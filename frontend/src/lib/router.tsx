import { useEffect, useState } from "react";

const ROUTE_CHANGE = "app:routechange";

const normalize = (path: string) => path.replace(/\/+$/, "") || "/";

export function navigate(to: string) {
  if (to === window.location.pathname) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event(ROUTE_CHANGE));
  window.scrollTo(0, 0);
}

export function replace(to: string) {
  if (to === window.location.pathname) return;
  window.history.replaceState({}, "", to);
  window.dispatchEvent(new Event(ROUTE_CHANGE));
  window.scrollTo(0, 0);
}

export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener("popstate", sync);
    window.addEventListener(ROUTE_CHANGE, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(ROUTE_CHANGE, sync);
    };
  }, []);

  return path;
}

export const matchPath = (path: string, route: string) => normalize(path) === normalize(route);
