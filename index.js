import express from "express";
import bodyParser from "body-parser";
import "dotenv/config";
import { takeScreenshot } from "./util.js";
import cronJob from "./cron.js";
import sql from "./db.js";

const app = express();
const PORT = process.env.PORT || 9090;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
  })
);

app.use(express.json({ limit: "50mb" }));

app.get("/", (req, res) => {
  res.send("Hey!");
});

app.post("/thumbnail", bodyParser.json(), async (req, res) => {
  const payload = req.body;

  if (!payload.formId)
    return res.status(400).send({
      success: false,
      message: "Url is missing",
    });

  const url = `${FRONTEND_URL}/form/${payload.formId}`;

  const imageUrl = await takeScreenshot(url, payload.fullpage);

  if (!imageUrl)
    return res.status(400).send({
      success: false,
      message: "Upload failed",
    });

  await sql`
    UPDATE public."Form"
  SET thumbnail=${imageUrl} WHERE id=${payload.formId}`;

  return res.status(200).send({
    success: true,
    message: imageUrl,
  });
});

cronJob.start();

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
