import { LandingGate } from "./app/landing/LandingGate";
import { ProductFrame, isProductPath } from "./app/shell/ProductFrame";
import { SessionProvider } from "./app/session";
import { useRoute } from "./lib/router";

export default function Root() {
  const path = useRoute();

  return (
    <SessionProvider>
      {isProductPath(path) ? <ProductFrame /> : <LandingGate />}
    </SessionProvider>
  );
}
