import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log(document.documentElement.className);
console.log(getComputedStyle(document.documentElement).getPropertyValue('--primary'))
createRoot(document.getElementById("root")!).render(<App />);

