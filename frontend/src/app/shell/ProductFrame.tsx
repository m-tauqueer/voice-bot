import { useEffect } from "react";
import { AdminPage } from "../admin/AdminPage";
import { ChatPage } from "../chat/ChatPage";
import { DashboardPage } from "../dashboard/DashboardPage";
import { PersonalHome } from "../dashboard/PersonalHome";
import { TabStub } from "../dashboard/TabStub";
import { VoicePage } from "../voice/VoicePage";
import { logoutUrl } from "../../lib/gateway";
import {
  loadNavConfig,
  navIdForPath,
  pathNeedsOwner,
  signInCopy,
  visibleNav,
} from "../../lib/nav";
import { matchPath, replace, useRoute } from "../../lib/router";
import { PRODUCT_ROUTES, ROUTES } from "../../lib/routes";
import { useSession } from "../session";
import { AppShell } from "./AppShell";
import { GateLayout, SignInCard } from "./SignInCard";

export function isProductPath(path: string): boolean {
  return PRODUCT_ROUTES.some((route) => matchPath(path, route));
}

function pageFor(
  path: string,
  owner: boolean,
  labels: { conversations: string; people: string },
) {
  if (matchPath(path, ROUTES.chat)) {
    return <ChatPage />;
  }
  if (matchPath(path, ROUTES.voice)) {
    return <VoicePage />;
  }
  if (matchPath(path, ROUTES.dashboardPersona)) {
    return <AdminPage />;
  }
  if (matchPath(path, ROUTES.dashboardConversations)) {
    return <TabStub title={labels.conversations} />;
  }
  if (matchPath(path, ROUTES.dashboardPeople)) {
    return <TabStub title={labels.people} />;
  }
  if (matchPath(path, ROUTES.dashboard)) {
    return owner ? <DashboardPage /> : <PersonalHome />;
  }
  return null;
}

export function ProductFrame() {
  const path = useRoute();
  const session = useSession();
  const nav = loadNavConfig();
  const resolved = matchPath(path, ROUTES.admin)
    ? ROUTES.dashboardPersona
    : path;
  const isOwner = session.status === "ready" && session.me.owner;

  useEffect(() => {
    if (matchPath(path, ROUTES.admin)) {
      replace(ROUTES.dashboardPersona);
      return;
    }
    if (session.status === "ready" && !isOwner && pathNeedsOwner(nav.items, resolved)) {
      replace(ROUTES.dashboard);
    }
  }, [path, resolved, session.status, isOwner, nav.items]);

  if (session.status === "loading") {
    return (
      <GateLayout>
        <p>{nav.loadingLabel}</p>
      </GateLayout>
    );
  }

  if (session.status === "signed_out") {
    const copy = signInCopy(resolved);
    return <SignInCard title={copy.title} body={copy.body} next={resolved} />;
  }

  const items = visibleNav(nav.items, session.me.owner);
  const blocked = !session.me.owner && pathNeedsOwner(nav.items, resolved);
  const pagePath = blocked ? ROUTES.dashboard : resolved;
  const conversations =
    nav.items.find((item) => matchPath(item.to, ROUTES.dashboardConversations))
      ?.label ?? "";
  const people =
    nav.items.find((item) => matchPath(item.to, ROUTES.dashboardPeople))
      ?.label ?? "";

  return (
    <AppShell
      active={navIdForPath(items, pagePath)}
      items={items}
      brand={nav.appName}
      homeTo={ROUTES.dashboard}
      personaName={session.persona?.display_name ?? nav.appName}
      accountEmail={session.me.email}
      signOutLabel={nav.signOutLabel}
      onSignOut={() => {
        window.location.href = logoutUrl(pagePath);
      }}
    >
      {pageFor(pagePath, session.me.owner, { conversations, people })}
    </AppShell>
  );
}
