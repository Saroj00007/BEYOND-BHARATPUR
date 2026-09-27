import "dotenv/config";
import cors from "cors";
import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "yatraai-server" });
});

app.listen(port, () => {
  console.log(`YatraAI API listening on http://localhost:${port}`);
});
