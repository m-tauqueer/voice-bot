import { ChatPage } from "../chat/ChatPage";
import { PersonalHome } from "../dashboard/PersonalHome";
import { VoicePage } from "../voice/VoicePage";
import { logoutUrl } from "../../lib/gateway";
import {
  loadNavConfig,
  navIdForPath,
  personalNav,
  signInCopy,
} from "../../lib/nav";
import { matchPath, useRoute } from "../../lib/router";
import { ROUTES } from "../../lib/routes";
import { useSession } from "../session";
import { AppShell } from "./AppShell";
import { GateLayout, SignInCard } from "./SignInCard";

function pageFor(path: string) {
  if (matchPath(path, ROUTES.chat)) {
    return <ChatPage />;
  }
  if (matchPath(path, ROUTES.voice)) {
    return <VoicePage />;
  }
  return <PersonalHome />;
}

export function ProductFrame() {
  const path = useRoute();
  const session = useSession();
  const nav = loadNavConfig();

  if (session.status === "loading") {
    return (
      <GateLayout>
        <p>{nav.loadingLabel}</p>
      </GateLayout>
    );
  }

  if (session.status === "signed_out") {
    const copy = signInCopy(path);
    return <SignInCard title={copy.title} body={copy.body} next={path} />;
  }

  const items = personalNav(session.me.owner);

  return (
    <AppShell
      active={navIdForPath(items, path)}
      items={items}
      brand={nav.appName}
      homeTo={ROUTES.dashboard}
      personaName={session.persona?.display_name ?? nav.appName}
      accountEmail={session.me.email}
      signOutLabel={nav.signOutLabel}
      onSignOut={() => {
        window.location.href = logoutUrl(path);
      }}
    >
      {pageFor(path)}
    </AppShell>
  );
}
