import express, { Request } from "express";
import postRoutes from "./routes/postRoutes";
import wrappedRoutes from "./routes/wrappedRoutes";
import config from "./config";

const app = express();

const rawPort = config.port;
if (!rawPort || isNaN(Number(rawPort))) {
  throw new Error(`❌ Invalid or missing PORT env: "${rawPort}"`);
}

const PORT = Number(rawPort);

console.log("PORT ENV VALUE:", PORT);

app.use(express.json());
app.use("/api/posts", postRoutes);
app.use("/api/wrapped", wrappedRoutes);

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
