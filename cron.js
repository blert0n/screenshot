import cron from "cron";
import http from "http";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:9090";

const cronJob = new cron.CronJob("*/14 * * * *", () => {
  http
    .get(backendUrl, (res) => {
      if (res.statusCode === 200) {
        console.log("Server restarted");
      } else {
        console.error(
          `Failed to restart server with status code: ${res.statusCode}`
        );
      }
    })
    .on("error", (err) => console.error("Error during restart:", err.message));
});

export default cronJob;
