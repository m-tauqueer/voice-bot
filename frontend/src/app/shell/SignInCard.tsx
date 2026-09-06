import type { ReactNode } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import Grainient from "../../components/Grainient";
import { googleSignInUrl } from "../../lib/gateway";
import { loadNavConfig } from "../../lib/nav";

export function GateLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        padding: "32px 20px 72px",
        color: "var(--text-hi)",
        fontFamily: "var(--font-body)",
      }}
    >
      <Grainient color3="#202028" saturation={0.7} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 840,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function SignInCard({
  title,
  body,
  next,
}: {
  title: string;
  body: string;
  next: string;
}) {
  const { continueLabel } = loadNavConfig();
  return (
    <GateLayout>
      <Card>
        <h1 className="mc-pagehead__title" style={{ marginBottom: 8 }}>
          {title}
        </h1>
        <p style={{ color: "var(--text-mid)", marginBottom: 18 }}>{body}</p>
        <Button
          variant="solid"
          onClick={() => {
            window.location.href = googleSignInUrl(next);
          }}
        >
          {continueLabel}
        </Button>
      </Card>
    </GateLayout>
  );
}
