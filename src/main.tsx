import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { repairAndSyncLocalPlayerState } from "@/lib/exportRegistrations";

// Immediately self-heal any zombie clear flags and synchronize players before render
repairAndSyncLocalPlayerState();

createRoot(document.getElementById("root")!).render(<App />);
