import { SignInCard } from "../shell/SignInCard";
import { loadNavConfig } from "../../lib/nav";
import { ROUTES } from "../../lib/routes";

export function LandingPage() {
  const { appName, signIn } = loadNavConfig();
  return (
    <SignInCard title={appName} body={signIn.appBody} next={ROUTES.dashboard} />
  );
}
