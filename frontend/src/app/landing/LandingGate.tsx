import { useEffect } from "react";
import { loadNavConfig } from "../../lib/nav";
import { matchPath, replace, useRoute } from "../../lib/router";
import { ROUTES } from "../../lib/routes";
import { isHeldSessionStatus } from "../../lib/sessionState";
import { useSession } from "../session";
import { AccessCard } from "../shell/AccessCard";
import { GateLayout } from "../shell/SignInCard";
import { LandingPage } from "./LandingPage";

export function LandingGate() {
  const path = useRoute();
  const session = useSession();
  const { loadingLabel } = loadNavConfig();

  useEffect(() => {
    if (session.status === "ready") {
      replace(ROUTES.dashboard);
      return;
    }
    if (isHeldSessionStatus(session.status)) {
      if (!matchPath(path, ROUTES.waitlist)) {
        replace(ROUTES.waitlist);
      }
      return;
    }
    if (session.status === "signed_out" && !matchPath(path, ROUTES.home)) {
      replace(ROUTES.home);
    }
  }, [path, session.status]);

  if (session.status === "loading" || session.status === "ready") {
    return (
      <GateLayout>
        <p>{loadingLabel}</p>
      </GateLayout>
    );
  }

  if (isHeldSessionStatus(session.status)) {
    return <AccessCard status={session.status} />;
  }

  return <LandingPage />;
}
