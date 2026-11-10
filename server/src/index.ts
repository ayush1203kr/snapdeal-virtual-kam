import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import routes from "./routes/api.ts";
import { ensureDemoSeller } from "./seed/seedData.ts";

const app = express();
const port = Number(process.env.PORT || 4000);
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientOrigin = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map(origin => origin.trim())
  : true;

app.disable("x-powered-by");
app.use(cors({ origin: clientOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use("/api", routes);
app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
app.use("/api", (_request, response) => response.status(404).json({ error: "API endpoint not found" }));

if (process.env.NODE_ENV === "production") {
  const buildDirectory = path.resolve(currentDirectory, "../../dist");
  app.use(express.static(buildDirectory));
  app.get("*", (_request, response) => response.sendFile(path.join(buildDirectory, "index.html")));
}

app.use((error: any, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  process.stderr.write(`API error: ${error?.message || "Unknown error"}\n`);
  response.status(500).json({ error: "Something went wrong while processing the request. Please try again." });
});

async function start() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required. Copy .env.example to .env and configure MongoDB.");
  await mongoose.connect(process.env.MONGODB_URI);
  await ensureDemoSeller();
  const server = app.listen(port, () => process.stdout.write(`API listening on http://localhost:${port}\n`));

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

start().catch(error => {
  process.stderr.write(`Startup failed: ${error.message}\n`);
  process.exit(1);
});
