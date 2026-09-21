import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const outputDirectory = `${process.cwd()}/screenshot`;
const applicationUrl = pathToFileURL(`${process.cwd()}/dist/index.html`).href;

async function addMarkers(page, markers) {
  await page.evaluate((items) => {
    document.querySelectorAll("[data-help-screenshot-marker]").forEach(
      (element) => element.remove(),
    );
    for (const item of items) {
      const target = item.text
        ? Array.from(document.querySelectorAll("button")).find((element) =>
            element.textContent?.includes(item.text),
          )
        : document.querySelector(item.selector);
      if (!(target instanceof HTMLElement)) {
        throw new Error(
          `Screenshot target not found: ${item.selector ?? item.text}`,
        );
      }
      const bounds = target.getBoundingClientRect();
      const marker = document.createElement("span");
      marker.dataset.helpScreenshotMarker = item.label;
      marker.textContent = item.label;
      Object.assign(marker.style, {
        position: "fixed",
        zIndex: "2147483647",
        top: `${Math.max(8, bounds.top + item.y)}px`,
        left: `${Math.max(8, bounds.left + item.x)}px`,
        display: "grid",
        width: "30px",
        height: "30px",
        placeItems: "center",
        border: "3px solid white",
        borderRadius: "50%",
        color: "white",
        background: "#176b87",
        boxShadow: "0 2px 10px rgb(0 0 0 / 35%)",
        font: "800 14px ui-monospace, monospace",
      });
      document.body.append(marker);
    }
  }, markers);
}

async function captureWebp(page, filename) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.screenshot({
    path: `${outputDirectory}/${filename}`,
    type: "webp",
    quality: 88,
  });
  console.log(`Captured screenshot/${filename}`);
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({
  headless: false,
  args: ["--disable-gpu"],
});
const context = await browser.newContext({
  acceptDownloads: true,
  colorScheme: "light",
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
await page.addInitScript(() => {
  localStorage.setItem("protocol-box:locale", "en");
  localStorage.setItem("protocol-box:appearance", "light");
});

try {
  await page.goto(applicationUrl);
  await page
    .getByRole("button", { name: "Create new Author Key" })
    .click();
  await page
    .getByLabel("Key Bundle password", { exact: true })
    .waitFor();
  await addMarkers(page, [
    { selector: 'input[type="password"]', label: "1", x: -12, y: -12 },
    {
      text: "Create New Key Bundle",
      label: "2",
      x: -12,
      y: -12,
    },
    {
      selector: 'input[autocomplete="new-password"]',
      label: "3",
      x: -12,
      y: -12,
    },
  ]);
  await captureWebp(page, "author-access.webp");

  await page
    .getByLabel("Key Bundle password", { exact: true })
    .fill("screenshot-only-passphrase");
  await page
    .getByLabel("Confirm Key Bundle password", { exact: true })
    .fill("screenshot-only-passphrase");
  await page
    .getByRole("button", { name: "Create New Key Bundle" })
    .press("Enter");
  await page.getByRole("button", { name: "Continue" }).press("Enter");
  await page
    .getByRole("button", { name: "New Unsigned Draft" })
    .first()
    .press("Enter");
  await page
    .getByLabel("Start with buffer preparation example")
    .check();
  await page
    .getByRole("button", { name: "Create Unsigned Draft" })
    .press("Enter");
  await page
    .getByRole("navigation", { name: "Protocol Sections" })
    .waitFor();

  await addMarkers(page, [
    { selector: ".protocol-outline", label: "1", x: 12, y: 58 },
    { selector: ".editor-toolbar", label: "2", x: 12, y: 8 },
    { selector: ".document-canvas", label: "3", x: 12, y: 18 },
    { selector: ".context-inspector", label: "4", x: 12, y: 58 },
    { selector: ".operation-status", label: "5", x: 12, y: -8 },
  ]);
  await captureWebp(page, "authoring.webp");

  await page.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await page
    .getByRole("navigation", { name: "Author workspace areas" })
    .getByRole("button", { name: "Publish" })
    .press("Enter");
  await page.getByRole("heading", { name: "Publish Protocol" }).waitFor();
  await addMarkers(page, [
    { selector: ".publish-step:nth-child(1)", label: "1", x: 12, y: 12 },
    { selector: ".publish-step:nth-child(2)", label: "2", x: 12, y: 12 },
    { selector: ".publish-step:nth-child(3)", label: "3", x: 12, y: 12 },
    { selector: ".recovery-panel", label: "4", x: 12, y: 12 },
  ]);
  await captureWebp(page, "publish-readiness.webp");
} finally {
  await browser.close();
}
