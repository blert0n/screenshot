import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import cronJob from "./cron.js";
import "dotenv/config";
import { takeScreenshot } from "./util.js";

const app = express();
const PORT = process.env.PORT || 9090;
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

  if (!payload.url || !payload.id)
    return res.status(400).send({
      success: false,
      message: "Url is missing",
    });

  const imageUrl = await takeScreenshot(
    payload.url,
    payload.fullpage,
    payload.backgroundColor
  );

  if (!imageUrl)
    return res.status(400).send({
      success: false,
      message: "Upload failed",
    });

  const data = {
    id: payload.id,
    imageUrl,
  };

  return res.status(200).send({
    success: true,
    data,
  });
});

cronJob.start();

app.listen(PORT, () => {
  console.log(`Screenshot app listening on port ${PORT}`);
});
