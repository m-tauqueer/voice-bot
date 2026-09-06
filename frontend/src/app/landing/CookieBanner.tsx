import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { requiredVite } from "../../lib/env";
import { loadUiCopy } from "../../lib/uiCopy";

function cookieKey() {
  return requiredVite("VITE_COOKIE_STORAGE_KEY");
}

function cookieValue() {
  return requiredVite("VITE_COOKIE_STORAGE_VALUE");
}

export function CookieBanner() {
  const copy = loadUiCopy();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(cookieKey()) !== cookieValue());
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        left: 16,
        zIndex: 40,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <Card
        style={{
          pointerEvents: "auto",
          maxWidth: 720,
          width: "100%",
          display: "flex",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <p style={{ color: "var(--text-mid)", margin: 0, flex: "1 1 240px" }}>
          {copy.cookieNoticeBody}
        </p>
        <Button
          type="button"
          variant="solid"
          onClick={() => {
            window.localStorage.setItem(cookieKey(), cookieValue());
            setVisible(false);
          }}
        >
          {copy.cookieNoticeAccept}
        </Button>
      </Card>
    </div>
  );
}
