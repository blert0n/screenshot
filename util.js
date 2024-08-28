import { chromium } from "playwright";
import { v2 as cloudinary } from "cloudinary";
import "dotenv/config";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function takeScreenshot(
  url,
  fullpage = false,
  backgroundColor = "#ffffff"
) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(url);

  await page.waitForLoadState("networkidle");

  await page.waitForSelector("div#form");

  await page.waitForFunction(() => {
    const images = Array.from(document.querySelectorAll("img"));
    return images.every((img) => img.complete && img.naturalHeight > 0);
  });

  await page.addStyleTag({
    content: `
      html, body, div#__next, main {
          height: auto !important;
          width: auto !important;
          background-color: ${backgroundColor};
      }
  `,
  });

  const screenshotBuffer = await page.screenshot({ fullPage: fullpage });
  await browser.close();

  const imageUrl = await uploadToCloudinary(screenshotBuffer);
  return imageUrl;
}

export function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ resource_type: "image" }, (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result.secure_url);
      })
      .end(buffer);
  });
}
