import { SignInCard } from "../shell/SignInCard";
import { loadNavConfig } from "../../lib/nav";
import { navigate } from "../../lib/router";
import { ROUTES } from "../../lib/routes";
import { loadUiCopy } from "../../lib/uiCopy";

export function LandingPage() {
  const { appName, signIn } = loadNavConfig();
  const copy = loadUiCopy();
  return (
    <>
      <SignInCard title={appName} body={signIn.appBody} next={ROUTES.dashboard} />
      <p
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          color: "var(--text-mid)",
        }}
      >
        <button
          type="button"
          style={{
            background: "none",
            border: 0,
            color: "inherit",
            textDecoration: "underline",
            cursor: "pointer",
          }}
          onClick={() => navigate(ROUTES.privacy)}
        >
          {copy.privacyTitle}
        </button>
        {" · "}
        <button
          type="button"
          style={{
            background: "none",
            border: 0,
            color: "inherit",
            textDecoration: "underline",
            cursor: "pointer",
          }}
          onClick={() => navigate(ROUTES.terms)}
        >
          {copy.termsTitle}
        </button>
      </p>
    </>
  );
}
