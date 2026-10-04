import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { resolveConvexUrl } from "./lib/convexUrl";
import "./index.css";

const convex = new ConvexReactClient(resolveConvexUrl());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConvexProvider>
  </StrictMode>,
);
