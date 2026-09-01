import { TabStub } from "./TabStub";
import { loadNavConfig } from "../../lib/nav";
import { matchPath } from "../../lib/router";
import { ROUTES } from "../../lib/routes";

export function DashboardPage() {
  const { items, ownerRole } = loadNavConfig();
  const title =
    items.find(
      (item) =>
        matchPath(item.to, ROUTES.dashboard) && item.roles.includes(ownerRole),
    )?.label ?? "";
  return <TabStub title={title} />;
}
