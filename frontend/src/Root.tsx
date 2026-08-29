import { AdminPage } from "./app/admin/AdminPage";
import { ChatPage } from "./app/chat/ChatPage";
import { DashboardPage } from "./app/dashboard/DashboardPage";
import { OptimizedComponentsPage } from "./pages/optimized-components";
import { matchPath, useRoute } from "./lib/router";
import { ROUTES } from "./lib/routes";

export default function Root() {
  const path = useRoute();

  if (matchPath(path, ROUTES.chat)) return <ChatPage />;
  if (matchPath(path, ROUTES.admin)) return <AdminPage />;
  if (matchPath(path, ROUTES.dashboard)) return <DashboardPage />;
  return <OptimizedComponentsPage />;
}
