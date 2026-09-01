/**
 * Role-filtered nav: owner sees ops tabs; a tester never sees those items.
 */
import {
  loadNavConfig,
  pathNeedsOwner,
  visibleNav,
} from "./nav";
import { ROUTES } from "./routes";

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`${name}=ok${detail ? ` ${detail}` : ""}`);
    return;
  }
  console.error(`${name}=FAIL${detail ? ` ${detail}` : ""}`);
  failed += 1;
}

const nav = loadNavConfig();
const ownerItems = visibleNav(nav.items, true);
const memberItems = visibleNav(nav.items, false);

console.log(`owner_nav=${ownerItems.map((item) => item.label).join(",")}`);
console.log(`member_nav=${memberItems.map((item) => item.label).join(",")}`);

check("owner_nav_not_empty", ownerItems.length > 0);
check("member_nav_not_empty", memberItems.length > 0);

for (const item of ownerItems) {
  check(
    `owner_can_see_${item.id}`,
    item.roles.includes(nav.ownerRole),
  );
}

for (const item of memberItems) {
  check(
    `member_can_see_${item.id}`,
    item.roles.includes(nav.memberRole),
  );
}

const ownerOnly = nav.items.filter(
  (item) =>
    item.roles.includes(nav.ownerRole) &&
    !item.roles.includes(nav.memberRole),
);

for (const item of ownerOnly) {
  check(
    `member_hidden_${item.id}`,
    !memberItems.some((visible) => visible.id === item.id),
  );
  const sharedWithMember = nav.items.some(
    (other) =>
      other.to === item.to && other.roles.includes(nav.memberRole),
  );
  if (!sharedWithMember) {
    check(`owner_only_path_${item.id}`, pathNeedsOwner(nav.items, item.to));
  }
}

check(
  "shared_dashboard_not_owner_only",
  !pathNeedsOwner(nav.items, ROUTES.dashboard),
);
check(
  "persona_path_is_owner_only",
  pathNeedsOwner(nav.items, ROUTES.dashboardPersona),
);

if (failed) {
  console.error(`FAIL: ${failed} check(s)`);
  process.exit(1);
}
console.log("PROBE_OK");
