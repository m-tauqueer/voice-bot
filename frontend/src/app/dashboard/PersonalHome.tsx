import { useSession } from "../session";
import { loadNavConfig } from "../../lib/nav";

export function PersonalHome() {
  const session = useSession();
  const { appName } = loadNavConfig();
  const personaName =
    session.status === "ready" && session.persona
      ? session.persona.display_name
      : appName;
  return (
    <div className="mc-wrap">
      <div className="mc-pagehead">
        <div>
          <h1 className="mc-pagehead__title">{personaName}</h1>
        </div>
      </div>
    </div>
  );
}
