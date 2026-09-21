import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { ProtocolCore, type Protocol } from "../src/domain/protocol";

async function createAuthorKey(page: Page, passphrase: string): Promise<void> {
  await page.getByRole("button", { name: "Create new Author Key" }).press("Enter");
  await page.getByLabel("Key Bundle password", { exact: true }).fill(passphrase);
  await page
    .getByLabel("Confirm Key Bundle password", { exact: true })
    .fill(passphrase);
  await page
    .getByRole("button", { name: "Create New Key Bundle" })
    .press("Enter");
  await page
    .getByRole("button", { name: "Continue to Unsigned Drafts" })
    .press("Enter");
}

async function readCachedKeyBundleJson(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const opening = indexedDB.open("protocol-box-author");
        opening.onerror = () =>
          reject(opening.error ?? new Error("Could not open IndexedDB"));
        opening.onsuccess = () => {
          const transaction = opening.result.transaction(
            "recoveryCopies",
            "readonly",
          );
          const request = transaction.objectStore("recoveryCopies").getAll();
          request.onerror = () =>
            reject(request.error ?? new Error("Could not read recovery copies"));
          request.onsuccess = () => {
            const recoveryCopy = request.result[0];
            if (recoveryCopy === undefined) {
              reject(new Error("Expected a recovery copy"));
              return;
            }
            const json = JSON.stringify(recoveryCopy.keyBundle);
            if (json === undefined) {
              reject(new Error("Expected serializable Key Bundle JSON"));
              return;
            }
            resolve(json);
          };
        };
      }),
  );
}

test("blank Application HTML is self-contained and identifies its document kind", async ({
  page,
}) => {
  await page.goto(pathToFileURL(`${process.cwd()}/dist/index.html`).href);

  await expect(page.getByRole("heading", { name: "Protocol Box" })).toBeVisible();
  const dataBlock = page.locator(
    'script#protocol-box-data[type="application/octet-stream"]',
  );
  await expect(dataBlock).toHaveCount(1);

  const envelope = JSON.parse(
    Buffer.from((await dataBlock.textContent())!.trim(), "base64url").toString(
      "utf8",
    ),
  );
  expect(envelope).toEqual({
    documentKind: "protocol-box/application",
    formatVersion: 1,
    appVersion: "0.0.0",
    protocol: null,
    signature: null,
  });

  await expect(
    page.locator('script[src], link[rel="stylesheet"][href]'),
  ).toHaveCount(0);
});

test("appearance preference supports Light, Dark, and System modes", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(pathToFileURL(`${process.cwd()}/dist/index.html`).href);

  const appearance = page.getByRole("combobox", { name: "Appearance" });
  await expect(appearance).toContainText("System");
  const lightBackground = await page.locator("body").evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  const lightCard = await page.locator("header").evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );

  await appearance.press("Enter");
  await page.getByRole("option", { name: "Dark" }).press("Enter");
  await expect
    .poll(() =>
      page.locator("body").evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    )
    .not.toBe(lightBackground);
  await expect
    .poll(() =>
      page.locator("header").evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    )
    .not.toBe(lightCard);

  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Appearance" }),
  ).toContainText("Dark");
  await expect
    .poll(() =>
      page.locator("body").evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    )
    .not.toBe(lightBackground);

  await page.getByRole("combobox", { name: "Appearance" }).press("Enter");
  await page.getByRole("option", { name: "System" }).press("Enter");
  await expect
    .poll(() =>
      page.locator("body").evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    )
    .toBe(lightBackground);
  await expect
    .poll(() =>
      page.locator("header").evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    )
    .toBe(lightCard);
});

test("Author shell remains keyboard-visible and explicit on a narrow screen", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(pathToFileURL(`${process.cwd()}/dist/index.html`).href);

  await expect(
    page.getByText("Author editing is supported as a desktop workflow."),
  ).toBeVisible();
  const openKeyBundle = page.getByRole("button", {
    name: "Open Key Bundle file",
  });
  await openKeyBundle.focus();
  expect(
    await openKeyBundle.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        style: style.outlineStyle,
        width: Number.parseFloat(style.outlineWidth),
        transitionDuration: style.transitionDuration,
      };
    }),
  ).toMatchObject({
    style: "solid",
    width: 3,
    transitionDuration: "1e-05s",
  });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("Author Guide supports deep links, bilingual chapters, and contextual return", async ({
  page,
}) => {
  await page.goto(pathToFileURL(`${process.cwd()}/dist/index.html`).href);

  const learnAuthorKeys = page.getByRole("button", {
    name: "Learn about Author Keys",
  });
  await learnAuthorKeys.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Author Key and access", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Author Guide chapters" }),
  ).toBeVisible();
  await expect(page.getByText("Screenshot unavailable in this build")).toBeVisible();
  await page.getByRole("button", { name: "Back to workbench" }).press("Enter");
  await expect(learnAuthorKeys).toBeFocused();

  await page.goto(
    `${pathToFileURL(`${process.cwd()}/dist/index.html`).href}#help/troubleshooting`,
  );
  await expect(
    page.getByRole("table", { name: "If something goes wrong" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Publish and recovery" }),
  ).toBeVisible();

  await page.goto(
    `${pathToFileURL(`${process.cwd()}/dist/index.html`).href}#help/security`,
  );
  await expect(
    page.getByRole("heading", { name: "Security and evidence", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Know these limits before relying on a file"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Author custody" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Reader verification" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table").getByRole("row", { name: /Author Key ID/ }),
  ).toBeVisible();
  await page
    .getByText("Current cryptographic format details", { exact: true })
    .press("Enter");
  await expect(page.getByText(/at least 600,000 iterations/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Author Key and access" }),
  ).toBeVisible();

  await page.goto(
    `${pathToFileURL(`${process.cwd()}/dist/index.html`).href}#help/author/formulas`,
  );
  await expect(
    page.getByRole("heading", {
      name: "Formulas and Formula Test Cases",
      level: 1,
    }),
  ).toBeVisible();
  await page.getByText("States and boundaries", { exact: true }).press("Enter");
  await expect(page.getByText("Deterministic Decimal", { exact: true })).toBeVisible();
  const language = page.getByRole("combobox", { name: "Language" });
  await language.press("Enter");
  await page.getByRole("option", { name: "Simplified Chinese" }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "公式与公式测试用例", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("确定性 Decimal", { exact: true })).toBeVisible();
  await page.goto(
    `${pathToFileURL(`${process.cwd()}/dist/index.html`).href}#help/security`,
  );
  await expect(
    page.getByRole("heading", { name: "安全与证据", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("作者保管责任", { exact: true })).toBeVisible();
  await expect(page.getByText("阅读者核验", { exact: true })).toBeVisible();
});

test("New Draft can start from the localized buffer example", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("protocol-box:locale", "en");
  });
  await page.goto(pathToFileURL(`${process.cwd()}/dist/index.html`).href);
  await createAuthorKey(page, "example draft passphrase");
  const authorNavigation = page.getByRole("navigation", {
    name: "Author workspace areas",
  });
  const navigationToggle = page.getByRole("button", {
    name: "Toggle Author navigation",
  });
  await expect(authorNavigation).toBeVisible();
  await navigationToggle.press("Enter");
  await expect(authorNavigation).toBeHidden();
  await expect(navigationToggle).toHaveAttribute("aria-expanded", "false");
  await navigationToggle.press("Enter");
  await expect(authorNavigation).toBeVisible();

  const draftSearch = page.getByPlaceholder("Title or Draft ID");
  const searchGeometry = await draftSearch.evaluate((input) => {
    const icon = input.parentElement?.querySelector("svg");
    const inputBox = input.getBoundingClientRect();
    const iconBox = icon?.getBoundingClientRect();
    return {
      contentStart: inputBox.left + Number.parseFloat(getComputedStyle(input).paddingLeft),
      iconRight: iconBox?.right ?? inputBox.left,
    };
  });
  expect(searchGeometry.contentStart).toBeGreaterThan(searchGeometry.iconRight);
  const forkLabel = page
    .getByLabel("Explicitly Fork under this Author Key")
    .locator("..");
  expect(
    await forkLabel.evaluate((label) => getComputedStyle(label).display),
  ).toBe("flex");
  await page
    .getByRole("button", { name: "New Unsigned Draft" })
    .first()
    .press("Enter");

  const newDraftDialog = page.getByRole("dialog", {
    name: "New Unsigned Draft",
  });
  const titleInput = newDraftDialog.getByLabel("Protocol title");
  const blankOption = newDraftDialog.getByRole("radio", {
    name: /Blank Protocol/,
  });
  const exampleOption = newDraftDialog.getByRole("radio", {
    name: /Buffer preparation example/,
  });
  await expect(blankOption).toBeChecked();
  await expect(exampleOption).not.toBeChecked();
  await expect(titleInput).toHaveAttribute("data-slot", "input");
  await titleInput.fill("");
  await expect(titleInput).toHaveAttribute("aria-invalid", "true");
  await expect(newDraftDialog.getByText("Enter a Protocol title.")).toBeVisible();
  await expect(
    newDraftDialog.getByRole("button", { name: "Create Unsigned Draft" }),
  ).toBeDisabled();
  await titleInput.fill("Untitled Protocol");
  await exampleOption.focus();
  await exampleOption.press("Space");
  await expect(titleInput).toHaveValue(
    "Buffer preparation example",
  );
  await page
    .getByRole("button", { name: "Create Unsigned Draft" })
    .press("Enter");

  await expect(
    page
      .getByRole("navigation", { name: "Protocol Sections" })
      .locator(".tree-node"),
  ).toHaveText([
    "1 Review the calculation",
    "2 Measure the stock solution",
    "3 Add the diluent",
  ]);
  const outline = page.getByRole("complementary").filter({
    has: page.getByRole("navigation", { name: "Protocol structure" }),
  });
  expect(
    await outline.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .getByRole("navigation", { name: "Protocol Sections" })
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await expect(
    page.getByRole("navigation", { name: "Protocol structure" }),
  ).not.toContainText("Variables");
  const sectionNavigation = page.getByRole("navigation", {
    name: "Protocol Sections",
  });
  await sectionNavigation
    .getByRole("button", { name: "3 Add the diluent" })
    .press("Enter");
  await expect(
    page.getByRole("switch", {
      name: "Require all checklist items before completion",
    }),
  ).toBeChecked();
  await expect(page.getByText("2 checklist items detected.")).toBeVisible();
  const addSectionButton = page.getByRole("button", { name: "Add Section" });
  expect(
    await addSectionButton.evaluate(
      (button, sectionList) =>
        button.getBoundingClientRect().top >=
        (sectionList as HTMLElement).getBoundingClientRect().bottom,
      await sectionNavigation.elementHandle(),
    ),
  ).toBe(true);

  const authorWorkspace = page.getByRole("tablist", {
    name: "Author workspace",
  });
  await expect(authorWorkspace.getByRole("tab")).toHaveText([
    "Summary",
    "Details",
    "Variables",
    "Formula tests",
  ]);
  await authorWorkspace.getByRole("tab", { name: "Summary" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Protocol summary" })).toBeVisible();
  await authorWorkspace.getByRole("tab", { name: "Variables" }).press("Enter");
  await expect(
    page.getByRole("table", { name: "Variable Definitions" }).getByRole("row"),
  ).toHaveCount(6);
  await authorWorkspace
    .getByRole("tab", { name: "Formula tests" })
    .press("Enter");
  const formulaTable = page.getByRole("table", { name: "Formula Test Cases" });
  await expect(formulaTable).toContainText("Standard dilution");
  await formulaTable
    .getByRole("row")
    .filter({ hasText: "Standard dilution" })
    .press("Enter");
  await expect(
    page.locator(".context-inspector").getByLabel("Description"),
  ).toHaveValue("100 mL at 10 mM from 100 mM stock");
});

test("Author mode reports a missing IndexedDB capability before opening", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto(pathToFileURL(`${process.cwd()}/dist/index.html`).href);

  await expect(page.getByRole("status")).toHaveText(
    "IndexedDB is unavailable; Author mode cannot store encrypted Unsigned Drafts.",
  );
  await expect(
    page.getByRole("button", { name: "Create new Author Key" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Open Key Bundle file" })).toBeDisabled();
  expect(consoleErrors).toContain(
    "[Protocol Box] Author mode disabled: IndexedDB is unavailable.",
  );
});

test("Author mode reports a missing Web Crypto capability", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "crypto", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto(pathToFileURL(`${process.cwd()}/dist/index.html`).href);

  await expect(page.getByRole("status")).toHaveText(
    "Web Crypto is unavailable; Author Key and Unsigned Draft operations are disabled.",
  );
  await expect(
    page.getByRole("button", { name: "Create new Author Key" }),
  ).toBeDisabled();
  expect(consoleErrors).toContain(
    "[Protocol Box] Author mode disabled: Web Crypto is unavailable.",
  );
});

test("Author mode reports when IndexedDB cannot open for the local origin", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: {
        open: () => {
          throw new DOMException(
            "Access denied for this origin",
            "SecurityError",
          );
        },
      },
    });
  });
  await page.goto(pathToFileURL(`${process.cwd()}/dist/index.html`).href);

  await expect(page.getByRole("status")).toHaveText(
    "IndexedDB could not be opened; Author mode is disabled: Access denied for this origin",
  );
  await expect(
    page.getByRole("button", { name: "Create new Author Key" }),
  ).toBeDisabled();
  expect(consoleErrors).toContain(
    "[Protocol Box] Author mode disabled: IndexedDB could not be opened (SecurityError: Access denied for this origin).",
  );
});

test("Author mode disables Published Protocol import when file opening is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "File", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto(pathToFileURL(`${process.cwd()}/dist/index.html`).href);
  await createAuthorKey(page, "file capability passphrase");
  await expect(page.getByRole("heading", { name: "Unsigned Drafts" })).toBeVisible({
    timeout: 15_000,
  });

  await expect(page.getByLabel("Published Protocol HTML")).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText(
    "File opening is unavailable in this browser.",
  );
});

test("Browser Key Bundle Recovery Copies import only after unlock and remain exportable", async ({
  page,
}) => {
  await page.goto(pathToFileURL(`${process.cwd()}/dist/index.html`).href);
  await page.getByRole("button", { name: "Create new Author Key" }).press("Enter");
  await page
    .getByLabel("Key Bundle password", { exact: true })
    .fill("browser recovery passphrase");
  await page
    .getByLabel("Confirm Key Bundle password", { exact: true })
    .fill("browser recovery passphrase");
  await page
    .getByRole("button", { name: "Create New Key Bundle" })
    .press("Enter");

  await expect(
    page.getByRole("alert").filter({ hasText: "Save an external Key Bundle copy" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Download JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy JSON" })).toBeVisible();
  const keyBundleJson = await readCachedKeyBundleJson(page);
  await page
    .getByRole("button", { name: "Continue to Unsigned Drafts" })
    .press("Enter");
  await page.getByRole("button", { name: "Lock", exact: true }).press("Enter");

  await expect(page.locator("textarea")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy JSON" })).toBeVisible();
  await page.getByRole("button", { name: "Forget all recovery copies" }).press("Enter");
  await page
    .getByRole("dialog", { name: "Forget all Browser Recovery Copies?" })
    .getByRole("button", { name: "Forget all recovery copies" })
    .press("Enter");
  await expect(page.getByText("No browser recovery copies are available.")).toBeVisible();

  await page.getByRole("button", { name: "Open Key Bundle file" }).press("Enter");
  await page.getByLabel("Key Bundle JSON file").setInputFiles({
    name: "recovered-key.json",
    mimeType: "application/json",
    buffer: Buffer.from(keyBundleJson),
  });
  await expect(page.getByRole("status")).toHaveText(
    "Key Bundle JSON loaded. Enter its password to unlock it.",
  );
  await page
    .getByLabel("Key Bundle password", { exact: true })
    .fill("wrong browser recovery passphrase");
  await page.getByRole("button", { name: "Unlock Key Bundle" }).press("Enter");
  await expect(page.getByRole("status")).toHaveText(
    "The Key Bundle password or authenticated contents are invalid.",
  );
  await page
    .getByLabel("Key Bundle password", { exact: true })
    .fill("browser recovery passphrase");
  await page.getByRole("button", { name: "Unlock Key Bundle" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Unsigned Drafts" })).toBeVisible();
  await page.getByRole("button", { name: "Lock", exact: true }).press("Enter");
  await expect(page.getByText("Imported from recovered-key.json")).toBeVisible();
});

test("a locked Draft route selects its required Browser Recovery Copy and resumes", async ({
  page,
}) => {
  await page.goto(pathToFileURL(`${process.cwd()}/dist/index.html`).href);
  await createAuthorKey(page, "route recovery passphrase");
  await page.getByRole("button", { name: "New Unsigned Draft" }).first().press("Enter");
  const dialog = page.getByRole("dialog", { name: "New Unsigned Draft" });
  await dialog.getByLabel("Protocol title").fill("Route intent Draft");
  await dialog
    .getByRole("button", { name: "Create Unsigned Draft" })
    .press("Enter");
  await expect(page.getByLabel("Protocol title")).toHaveValue("Route intent Draft");
  const draftRoute = page.url();
  await page.getByRole("button", { name: "Save and Lock" }).press("Enter");
  await expect(page).toHaveURL(/#\/author\/access$/);
  await page.goto(draftRoute);

  await expect(page.getByRole("heading", { name: "Author Key" })).toBeVisible();
  await expect(
    page.locator(".recovery-copy-select[aria-pressed='true']"),
  ).toHaveCount(1);
  await page
    .getByLabel("Key Bundle password", { exact: true })
    .fill("route recovery passphrase");
  await page.getByRole("button", { name: "Unlock selected Key Bundle" }).press("Enter");
  await expect(page).toHaveURL(draftRoute);
  await expect(page.getByLabel("Protocol title")).toHaveValue("Route intent Draft");
});

test("Author can edit, lock, unlock, and restore an encrypted Draft", async ({
  page,
  context,
}, testInfo) => {
  testInfo.setTimeout(60_000);
  await page.goto(pathToFileURL(`${process.cwd()}/dist/index.html`).href);

  await createAuthorKey(page, "playwright author passphrase");
  await expect(page.getByRole("heading", { name: "Unsigned Drafts" }))
    .toBeVisible({ timeout: 15_000 });

  await page.evaluate(() => {
    const files = new Map<string, string>();
    Object.defineProperty(globalThis, "__publishedFiles", { value: files });
    Object.defineProperty(globalThis, "showSaveFilePicker", {
      value: async (options: { suggestedName: string }) => ({
        name: options.suggestedName,
        createWritable: async () => ({
          write: async (bytes: Uint8Array) => {
            files.set(
              options.suggestedName,
              new TextDecoder().decode(bytes),
            );
          },
          close: async () => undefined,
        }),
      }),
    });
  });

  await page
    .getByRole("button", { name: "New Unsigned Draft" })
    .first()
    .press("Enter");
  const newDraftDialog = page.getByRole("dialog", {
    name: "New Unsigned Draft",
  });
  await newDraftDialog.getByLabel("Protocol title").fill("Browser lifecycle");
  await newDraftDialog
    .getByRole("button", { name: "Create Unsigned Draft" })
    .press("Enter");
  await expect(
    page.getByRole("navigation", { name: "Protocol Sections" }),
  ).toBeVisible();
  const undoButton = page.getByRole("button", { name: "Undo" });
  await expect(page.locator(".editor-toolbar")).not.toContainText("Undo");
  const undoBox = await undoButton.boundingBox();
  expect(undoBox).not.toBeNull();
  await page.mouse.move(
    undoBox!.x + undoBox!.width / 2,
    undoBox!.y + undoBox!.height / 2,
  );
  await expect(page.locator('[data-slot="tooltip-content"]')).toContainText("Undo");
  const editorGeometry = await page.evaluate(() => {
    const workspace = document.querySelector(".authoring-workspace");
    const workspaceHeading = document.querySelector(".workspace-heading");
    const pane = document.querySelector(".workbench-canvas");
    const canvas = document.querySelector(".document-canvas");
    const canvasViewport = canvas?.querySelector(
      '[data-slot="scroll-area-viewport"]',
    );
    const editor = document.querySelector(".tiptap");
    const toolbarButton = document.querySelector(".editor-toolbar button");
    const outlineViewport = document.querySelector(
      '.protocol-outline [data-slot="scroll-area-viewport"]',
    );
    const inspectorViewport = document.querySelector(
      '.context-inspector [data-slot="scroll-area-viewport"]',
    );
    const outlineSeparator = document.querySelector(
      '.resize-separator [aria-hidden="true"]',
    );
    if (
      !(workspace instanceof HTMLElement) ||
      !(workspaceHeading instanceof HTMLElement) ||
      !(pane instanceof HTMLElement) ||
      !(canvas instanceof HTMLElement) ||
      !(canvasViewport instanceof HTMLElement) ||
      !(editor instanceof HTMLElement) ||
      !(toolbarButton instanceof HTMLElement) ||
      !(outlineViewport instanceof HTMLElement) ||
      !(inspectorViewport instanceof HTMLElement) ||
      !(outlineSeparator instanceof HTMLElement)
    ) {
      throw new Error("Expected the Author editor layout");
    }
    return {
      workspaceHeight: workspace.getBoundingClientRect().height,
      workspaceHeadingHeight: workspaceHeading.getBoundingClientRect().height,
      paneOverflowY: getComputedStyle(pane).overflowY,
      paneClientHeight: pane.clientHeight,
      paneScrollHeight: pane.scrollHeight,
      canvasHeight: canvas.getBoundingClientRect().height,
      editorHeight: editor.getBoundingClientRect().height,
      editorMinHeight: getComputedStyle(editor).minHeight,
      canvasViewportOverflowY: getComputedStyle(canvasViewport).overflowY,
      toolbarFontSize: Number.parseFloat(
        getComputedStyle(toolbarButton).fontSize,
      ),
      outlineScrollbarWidth: getComputedStyle(outlineViewport).scrollbarWidth,
      inspectorScrollbarWidth:
        getComputedStyle(inspectorViewport).scrollbarWidth,
      outlineSeparatorColor:
        getComputedStyle(outlineSeparator).backgroundColor,
    };
  });
  expect(editorGeometry.paneOverflowY).toBe("hidden");
  expect(editorGeometry.paneScrollHeight).toBe(
    editorGeometry.paneClientHeight,
  );
  expect(editorGeometry.paneClientHeight).toBeGreaterThanOrEqual(
    editorGeometry.workspaceHeight - editorGeometry.workspaceHeadingHeight - 2,
  );
  expect(editorGeometry.canvasViewportOverflowY).toBe("scroll");
  expect(editorGeometry.toolbarFontSize).toBeLessThanOrEqual(12);
  expect(editorGeometry.outlineScrollbarWidth).toBe("none");
  expect(editorGeometry.inspectorScrollbarWidth).toBe("none");
  expect(editorGeometry.outlineSeparatorColor).not.toBe(
    "rgba(0, 0, 0, 0)",
  );
  expect(editorGeometry.editorHeight).toBeGreaterThan(200);
  expect(editorGeometry.editorHeight).toBeGreaterThanOrEqual(
    editorGeometry.canvasHeight - 2,
  );
  expect(editorGeometry.editorMinHeight).not.toBe("0px");
  await page.locator(".document-canvas").click({
    force: true,
    position: {
      x: 40,
      y: Math.max(1, Math.floor(editorGeometry.canvasHeight - 16)),
    },
  });
  await page.keyboard.type("Bottom entry");
  await expect(page.locator(".tiptap")).toContainText("Bottom entry");

  const outlineWidth = await page
    .locator(".protocol-outline")
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(outlineWidth).toBeGreaterThanOrEqual(200);
  await page
    .getByRole("button", { name: "Close Outline" })
    .press("Enter");
  await expect(page.locator(".protocol-outline")).toHaveCount(0);
  const openOutline = page
    .locator(".pane-actions")
    .getByRole("button", { name: "Open Outline" });
  const openOutlineFromEdge = page.getByRole("button", {
    name: "Open Outline from edge",
  });
  await expect(openOutline).toBeVisible();
  await expect(openOutline).toHaveAttribute("aria-expanded", "false");
  await expect(openOutlineFromEdge).toBeVisible();
  await openOutlineFromEdge.press("Enter");
  await expect(page.locator(".protocol-outline")).toBeVisible();
  expect(
    await page
      .locator(".protocol-outline")
      .evaluate((element) => element.getBoundingClientRect().width),
  ).toBe(outlineWidth);

  const inspectorWidth = await page
    .locator(".context-inspector")
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(inspectorWidth).toBeGreaterThanOrEqual(200);
  await page
    .getByRole("button", { name: "Close Inspector" })
    .press("Enter");
  await expect(page.locator(".context-inspector")).toHaveCount(0);
  const openInspector = page
    .locator(".pane-actions")
    .getByRole("button", { name: "Open Inspector" });
  const openInspectorFromEdge = page.getByRole("button", {
    name: "Open Inspector from edge",
  });
  await expect(openInspector).toBeVisible();
  await expect(openInspector).toHaveAttribute("aria-expanded", "false");
  await expect(openInspectorFromEdge).toBeVisible();
  await openInspectorFromEdge.press("Enter");
  await expect(page.locator(".context-inspector")).toBeVisible();
  expect(
    await page
      .locator(".context-inspector")
      .evaluate((element) => element.getBoundingClientRect().width),
  ).toBe(inspectorWidth);

  const addSection = page.getByRole("button", { name: "Add Section" });
  await expect(addSection).toBeVisible();
  await addSection.press("Enter");
  const sectionTitle = page.locator(".document-section-title");
  await expect(sectionTitle).toBeFocused();
  await sectionTitle.fill("Second");
  await page
    .getByRole("navigation", { name: "Protocol Sections" })
    .getByRole("button", { name: "Procedure" })
    .press("Enter");
  await addSection.press("Enter");
  await expect(sectionTitle).toBeFocused();
  await expect(
    page
      .getByRole("navigation", { name: "Protocol Sections" })
      .locator(".tree-node"),
  ).toHaveText(["1 Procedure", "2 Untitled Section", "3 Second"]);

  const authorWorkspace = page.getByRole("tablist", {
    name: "Author workspace",
  });
  await authorWorkspace.getByRole("tab", { name: "Variables" }).press("Enter");
  await expect(
    authorWorkspace.getByRole("tab", { name: "Variables" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "Variable Definitions" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add Variable" }).press("Enter");
  const variableForm = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "New Variable Definition" });
  await variableForm.getByLabel("Variable ID").fill("sampleVolume");
  await variableForm.getByLabel("Label", { exact: true }).fill("Sample volume");
  const variableTypeSelect = variableForm.getByRole("combobox", { name: "Type" });
  await variableTypeSelect.press("Enter");
  await page.getByRole("option", { name: "Numeric Input" }).press("Enter");
  await page
    .getByRole("button", { name: "Add Variable Definition" })
    .press("Enter");
  await page.getByRole("button", { name: "Add Variable" }).press("Enter");
  await variableForm.getByLabel("Variable ID").fill("adjustedVolume");
  await variableForm.getByLabel("Label", { exact: true }).fill("Adjusted volume");
  await variableForm.getByRole("combobox", { name: "Type" }).press("Enter");
  await page.getByRole("option", { name: "Numeric Derived" }).press("Enter");
  await variableForm.getByLabel("Formula", { exact: true }).fill(
    "sampleVolume + 0.2",
  );
  const formulaPreview = page.getByRole("region", {
    name: "Formula preview",
  });
  await expect(formulaPreview).toContainText(
    "Use decimal numbers, Variable IDs, + - * /, and parentheses.",
  );
  await formulaPreview
    .getByLabel("Preview value for Sample volume")
    .fill("0.1");
  await expect(formulaPreview.getByTestId("formula-result")).toHaveText("0.3");
  await variableForm
    .getByRole("button", { name: "Add Variable Definition" })
    .press("Enter");
  await authorWorkspace
    .getByRole("tab", { name: "Variables" })
    .press("ArrowRight");
  await expect(
    authorWorkspace.getByRole("tab", { name: "Formula Tests" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "Formula Test Cases" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add Formula Test" }).press("Enter");
  const formulaTestForm = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "New Formula Test Case" });
  await formulaTestForm.getByLabel("Title").fill("Adjusted volume example");
  await formulaTestForm.getByLabel(/Sample volume/).fill("0.1");
  await formulaTestForm.getByLabel(/Adjusted volume/).fill("0.3");
  await formulaTestForm
    .getByRole("button", { name: "Add Formula Test Case" })
    .press("Enter");
  await expect(
    page.getByRole("row", { name: /Adjusted volume example/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove Formula Test Case" })
    .press("Enter");
  await authorWorkspace
    .getByRole("tab", { name: "Formula Tests" })
    .press("Home");
  await expect(
    authorWorkspace.getByRole("tab", { name: "Summary" }),
  ).toHaveAttribute("aria-selected", "true");
  await authorWorkspace
    .getByRole("tab", { name: "Summary" })
    .press("ArrowRight");
  await expect(
    authorWorkspace.getByRole("tab", { name: "Details" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Procedure" })).toBeVisible();
  await page.getByLabel("Remote image URL").fill(
    "https://example.com/diagram.png",
  );
  const remoteImageButton = page.getByRole("button", {
    name: "Download and Embed",
  });
  await remoteImageButton.press("Enter");
  const remoteImageDialog = page.getByRole("dialog", {
    name: "Download remote image?",
  });
  await expect(remoteImageDialog).toBeVisible();
  await expect(
    remoteImageDialog.getByRole("button", { name: "Download and Embed" }),
  ).toBeFocused();
  await remoteImageDialog.getByRole("button", { name: "Cancel" }).press("Escape");
  await expect(remoteImageDialog).toBeHidden();
  await expect(remoteImageButton).toBeFocused();

  await authorWorkspace.getByRole("tab", { name: "Details" }).press("Enter");
  await page
    .getByRole("navigation", { name: "Protocol Sections" })
    .getByRole("button", { name: "Procedure" })
    .press("Enter");
  const formattingToolbar = page.getByRole("toolbar", {
    name: "Formatting",
  });
  await expect(
    formattingToolbar.getByRole("combobox", { name: "Block type" }),
  ).toHaveCount(0);
  const blockTypeButton = formattingToolbar.locator(".block-type-trigger");
  await expect(blockTypeButton).toHaveAccessibleName("Block type: Paragraph");
  await blockTypeButton.press("Enter");
  const blockTypeMenu = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Block type" }),
  });
  await expect(blockTypeMenu).toBeVisible();
  await blockTypeMenu.getByRole("button", { name: "Heading 3" }).press("Enter");
  await expect(blockTypeButton).toHaveAccessibleName("Block type: Heading 3");
  await blockTypeButton.press("Enter");
  await blockTypeMenu.getByRole("button", { name: "Paragraph" }).press("Enter");
  await expect(blockTypeButton).toHaveAccessibleName("Block type: Paragraph");

  const variableButton = formattingToolbar.getByRole("button", {
    name: "Insert Variable",
  });
  await variableButton.press("Enter");
  const variableMenu = page.getByRole("dialog", { name: "Insert Variable" });
  await variableMenu
    .getByRole("button", { name: "Sample volume (sampleVolume)" })
    .press("Enter");
  await expect(page.locator(".tiptap")).toContainText("{{ sampleVolume }}");
  await authorWorkspace.getByRole("tab", { name: "Variables" }).press("Enter");
  await page
    .getByRole("row", { name: /adjustedVolume Adjusted volume/ })
    .press("Enter");
  await page.getByRole("button", { name: "Remove Variable" }).press("Enter");
  await page
    .getByRole("row", { name: /sampleVolume Sample volume/ })
    .press("Enter");
  await page.getByRole("button", { name: "Remove Variable" }).press("Enter");
  await authorWorkspace.getByRole("tab", { name: "Details" }).press("Enter");

  await page.locator(".tiptap").fill("");
  const directLinkButton = formattingToolbar.getByRole("button", {
    name: "Edit link",
  });
  await expect(directLinkButton).not.toHaveAttribute("aria-pressed");
  await directLinkButton.press("Enter");
  const directLinkDialog = page.getByRole("dialog", { name: "Edit link" });
  await directLinkDialog
    .getByLabel("Link URL")
    .fill("https://example.com/direct");
  await directLinkDialog.getByRole("button", { name: "Apply Link" }).press("Enter");
  await expect(page.locator(".tiptap a")).toHaveText(
    "https://example.com/direct",
  );

  await page.locator(".tiptap").fill("Mix carefully.");
  await page.locator(".tiptap").press("Control+A");
  await formattingToolbar.getByRole("button", { name: "Bold" }).press("Enter");
  await expect(page.locator(".tiptap strong")).toHaveText("Mix carefully.");
  await page.locator(".tiptap").press("Control+A");
  await formattingToolbar
    .getByRole("button", { name: "Edit link" })
    .press("Enter");
  const linkDialog = page.getByRole("dialog", { name: "Edit link" });
  await expect(linkDialog).toBeVisible();
  await linkDialog
    .getByLabel("Link URL")
    .fill("https://example.com/procedure");
  await linkDialog.getByRole("button", { name: "Apply Link" }).press("Enter");
  await expect(linkDialog).toBeHidden();
  await expect(page.locator(".tiptap a")).toHaveAttribute(
    "href",
    "https://example.com/procedure",
  );
  await formattingToolbar.getByRole("button", { name: "Undo" }).press("Enter");
  await expect(page.locator(".tiptap a")).toHaveCount(0);
  await formattingToolbar.getByRole("button", { name: "Redo" }).press("Enter");
  await expect(page.locator(".tiptap a")).toHaveAttribute(
    "href",
    "https://example.com/procedure",
  );

  await page.locator(".tiptap").fill("Heading");
  await page.locator(".tiptap").press("Control+A");
  await blockTypeButton.press("Enter");
  await page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "Block type" }) })
    .getByRole("button", { name: "Heading 3" })
    .press("Enter");
  await expect(page.locator(".tiptap h3")).toHaveText("Heading");
  expect(
    await page.locator(".tiptap h3").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontSize: Number.parseFloat(style.fontSize),
        fontWeight: Number.parseInt(style.fontWeight, 10),
      };
    }),
  ).toMatchObject({
    fontSize: expect.any(Number),
    fontWeight: expect.any(Number),
  });
  expect(
    await page
      .locator(".tiptap h3")
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThan(16);
  await page.locator(".tiptap").press("Control+Alt+6");
  await expect(
    page.locator(".tiptap h6").filter({ hasText: "Heading" }),
  ).toHaveText("Heading");

  await page.locator(".tiptap").fill("Emphasis");
  await page.locator(".tiptap").press("Control+A");
  await formattingToolbar.getByRole("button", { name: "Italic" }).press("Enter");
  await expect(page.locator(".tiptap em")).toHaveText("Emphasis");

  for (const [buttonName, expectedSelector] of [
    ["Bullet List", ".tiptap ul:not([data-type='taskList'])"],
    ["Ordered List", ".tiptap ol"],
    ["Task List", ".tiptap ul[data-type='taskList']"],
  ] as const) {
    await page.locator(".tiptap").fill("First");
    await page.locator(".tiptap").press("Control+A");
    await formattingToolbar
      .getByRole("button", { name: buttonName })
      .press("Enter");
    await expect(page.locator(expectedSelector)).toContainText("First");
  }

  await page.locator(".tiptap").fill("");
  await formattingToolbar
    .getByRole("button", { name: "Insert Table" })
    .press("Enter");
  await expect(page.locator(".tiptap table")).toBeVisible();
  await page.locator(".tiptap").fill("Mix carefully.");
  await page.locator(".tiptap").evaluate((element) => {
    const clipboard = new DataTransfer();
    clipboard.setData(
      "text/html",
      '<p>Safe paste</p><script>alert(1)</script><iframe src="https://attacker.example"></iframe>',
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    );
  });
  await expect(page.locator(".tiptap")).toContainText("Safe paste");
  await expect(page.locator(".tiptap script, .tiptap iframe")).toHaveCount(0);
  const savedEditorText = await page.locator(".tiptap").innerText();
  await page.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await expect(page.getByRole("status")).toHaveText("Unsigned Draft saved");
  await page.getByLabel("Protocol title").fill("Browser lifecycle revision");
  await page.getByRole("button", { name: "Save", exact: true }).press("Enter");
  const workspaceRail = page.getByRole("navigation", {
    name: "Author workspace areas",
  });
  await workspaceRail.getByRole("button", { name: "Publish" }).press("Enter");
  await page.getByRole("button", { name: "Restore snapshot 1" }).press("Enter");
  await workspaceRail.getByRole("button", { name: "Authoring" }).press("Enter");
  await authorWorkspace.getByRole("tab", { name: "Details" }).press("Enter");
  await expect(page.getByLabel("Protocol title")).toHaveValue(
    "Browser lifecycle",
  );

  await page.getByRole("button", { name: "Save and Lock" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Author Key" })).toBeVisible();
  await page
    .getByLabel("Key Bundle password", { exact: true })
    .fill("wrong passphrase");
  await page.getByRole("button", { name: "Unlock selected Key Bundle" }).press("Enter");
  await expect(page.getByRole("status")).toHaveText(
    "The Key Bundle password or authenticated contents are invalid.",
  );
  await page
    .getByLabel("Key Bundle password", { exact: true })
    .fill("playwright author passphrase");
  await page.getByRole("button", { name: "Unlock selected Key Bundle" }).press("Enter");
  await page.getByRole("button", { name: "Open Draft" }).press("Enter");

  await expect(page.getByLabel("Protocol title")).toHaveValue(
    "Browser lifecycle",
  );
  await expect(page.locator(".tiptap")).toContainText(savedEditorText);
  await expect(page.locator(".tiptap table")).toBeVisible();

  await workspaceRail.getByRole("button", { name: "Publish" }).press("Enter");
  await page.getByLabel("Published HTML filename").fill(
    "browser-lifecycle.html",
  );
  const publishButton = page.getByRole("button", { name: "Publish Protocol" });
  await publishButton.press("Enter");
  const publishDialog = page.getByRole("dialog", {
    name: "Publish Protocol files?",
  });
  await expect(publishDialog).toBeVisible();
  await expect(
    publishDialog.getByRole("button", { name: "Continue to File Picker" }),
  ).toBeFocused();
  await publishDialog.getByRole("button", { name: "Cancel" }).press("Escape");
  await expect(publishDialog).toBeHidden();
  await expect(publishButton).toBeFocused();

  await publishButton.press("Enter");
  await publishDialog
    .getByRole("button", { name: "Continue to File Picker" })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "Publication Complete" }),
  ).toBeVisible();
  const publishedFiles = await page.evaluate(() =>
    [...(globalThis as typeof globalThis & {
      __publishedFiles: Map<string, string>;
    }).__publishedFiles.entries()],
  );
  expect(publishedFiles.map(([name]) => name)).toEqual([
    "browser-lifecycle.html",
    "browser-lifecycle.html.sha256",
  ]);
  expect(publishedFiles[0]?.[1]).toContain(
    'http-equiv="Content-Security-Policy"',
  );
  expect(publishedFiles[1]?.[1]).toMatch(
    /^[0-9a-f]{64}  browser-lifecycle\.html\n$/,
  );
  expect(publishedFiles[1]?.[1]).toBe(
    `${createHash("sha256").update(publishedFiles[0]![1]).digest("hex")}  browser-lifecycle.html\n`,
  );

  const publishedPage = await context.newPage();
  const networkRequests: string[] = [];
  const cspErrors: string[] = [];
  publishedPage.on("request", (request) => {
    if (/^https?:/.test(request.url())) networkRequests.push(request.url());
  });
  publishedPage.on("console", (message) => {
    if (/content security policy/i.test(message.text())) {
      cspErrors.push(message.text());
    }
  });
  const publishedPath = testInfo.outputPath("browser-lifecycle.html");
  await writeFile(publishedPath, publishedFiles[0]![1], "utf8");
  await context.setOffline(true);
  await publishedPage.goto(pathToFileURL(publishedPath).href);
  await expect(
    publishedPage.getByRole("heading", { name: "Protocol Box" }),
  ).toBeVisible();
  await expect(
    publishedPage.locator(
      'meta[http-equiv="Content-Security-Policy"]',
    ),
  ).toHaveCount(1);
  const contentSecurityPolicy = await publishedPage
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  expect(contentSecurityPolicy).toContain("default-src 'none'");
  expect(contentSecurityPolicy).toContain("script-src-elem ");
  expect(contentSecurityPolicy).toContain("script-src-attr 'none'");
  expect(contentSecurityPolicy).toContain("style-src-elem ");
  expect(contentSecurityPolicy).toContain("style-src-attr 'unsafe-inline'");
  expect(contentSecurityPolicy).toContain("connect-src 'none'");
  expect(contentSecurityPolicy).toContain("frame-src 'none'");
  expect(contentSecurityPolicy).toContain("object-src 'none'");
  expect(contentSecurityPolicy).toContain("media-src 'none'");
  expect(contentSecurityPolicy).toContain("form-action 'none'");
  expect(contentSecurityPolicy).toContain("base-uri 'none'");

  const publishedAppearance = publishedPage.getByRole("combobox", {
    name: "Appearance",
  });
  await publishedAppearance.press("Enter");
  await publishedPage.getByRole("option", { name: "Dark" }).press("Enter");
  await publishedPage.keyboard.press("Escape");
  await expect(publishedAppearance).toContainText("Dark");
  await publishedPage
    .getByRole("button", { name: "Start Playback" })
    .press("Enter");
  const publishedJump = publishedPage.getByRole("button", {
    name: "Jump to Procedure",
  });
  await publishedJump.press("Enter");
  const publishedDialog = publishedPage.getByRole("dialog", {
    name: "Change Section?",
  });
  await expect(publishedDialog).toBeVisible();
  await publishedDialog.getByRole("button", { name: "Cancel" }).press("Escape");
  await expect(publishedDialog).toBeHidden();

  const createFork = publishedPage.getByRole("button", {
    name: "Create editable Fork",
  });
  await expect(createFork).toBeEnabled();
  await createFork.press("Enter");
  const forkDialog = publishedPage.getByRole("dialog", {
    name: "Create an editable Fork?",
  });
  await expect(forkDialog).toContainText(
    "The signed Published Protocol will not change.",
  );
  await expect(forkDialog).toContainText(
    "This Memory-only Playback Session will be discarded",
  );
  await forkDialog
    .getByRole("button", { name: "Continue to Author Access" })
    .press("Enter");
  await expect(
    publishedPage.getByRole("heading", { name: "Author Key" }),
  ).toBeVisible();
  await expect(
    publishedPage.getByRole("button", {
      name: "Cancel and return to Published Protocol",
    }),
  ).toBeVisible();

  await createAuthorKey(publishedPage, "published fork passphrase");
  await expect(publishedPage.getByLabel("Protocol title")).toHaveValue(
    "Browser lifecycle",
    { timeout: 20_000 },
  );
  await expect(publishedPage.getByText(/Forked from [0-9a-f]{16}/)).toBeVisible();
  await publishedPage
    .getByRole("button", { name: "Save", exact: true })
    .press("Enter");
  await publishedPage.getByLabel("Protocol title").fill("Editable fork");
  await publishedPage
    .getByRole("button", { name: "Back to Published Protocol" })
    .press("Enter");
  const returnDialog = publishedPage.getByRole("dialog", {
    name: "Return to the Published Protocol?",
  });
  await expect(
    returnDialog.getByRole("button", { name: "Save and return" }),
  ).toBeFocused();
  await expect(
    returnDialog.getByRole("button", { name: "Discard and return" }),
  ).toBeVisible();
  await returnDialog.getByRole("button", { name: "Save and return" }).press("Enter");

  const returnToFork = publishedPage.getByRole("button", {
    name: "Return to editable Fork",
  });
  await expect(returnToFork).toBeVisible();
  await returnToFork.press("Enter");
  await expect(
    publishedPage.getByRole("heading", { name: "Author Key" }),
  ).toBeVisible();
  await publishedPage
    .getByLabel("Key Bundle password", { exact: true })
    .fill("published fork passphrase");
  await publishedPage
    .getByRole("button", { name: "Unlock selected Key Bundle" })
    .press("Enter");
  await expect(publishedPage.getByLabel("Protocol title")).toHaveValue(
    "Editable fork",
  );
  await publishedPage
    .getByRole("button", { name: "Back to Published Protocol" })
    .press("Enter");
  await expect(
    publishedPage.getByRole("button", { name: "Return to editable Fork" }),
  ).toBeVisible();

  const decodedPublished = ProtocolCore.extractEnvelope(publishedFiles[0]![1]);
  expect(decodedPublished.ok).toBe(true);
  if (!decodedPublished.ok) throw new Error("Expected a Published Protocol");
  const mismatchedEnvelope = ProtocolCore.encodeEnvelope({
    ...decodedPublished.envelope,
    protocol: {
      ...decodedPublished.envelope.protocol,
      title: "Tampered title",
    },
  });
  const dataBlockStart =
    '<script id="protocol-box-data" type="application/octet-stream">';
  const mismatchContentStart =
    publishedFiles[0]![1].indexOf(dataBlockStart) + dataBlockStart.length;
  const mismatchContentEnd = publishedFiles[0]![1].indexOf(
    "</script>",
    mismatchContentStart,
  );
  const mismatchHtml =
    publishedFiles[0]![1].slice(0, mismatchContentStart) +
    mismatchedEnvelope +
    publishedFiles[0]![1].slice(mismatchContentEnd);
  const mismatchPath = testInfo.outputPath("signature-mismatch.html");
  await writeFile(mismatchPath, mismatchHtml, "utf8");
  const mismatchPage = await context.newPage();
  await mismatchPage.goto(pathToFileURL(mismatchPath).href);
  await mismatchPage
    .getByRole("dialog", { name: "Integrity details" })
    .getByRole("button", { name: "Close details" })
    .press("Enter");
  await expect(
    mismatchPage.getByRole("button", { name: "Create editable Fork" }),
  ).toBeDisabled();
  await expect(
    mismatchPage.getByText(
      "Forking requires Signature Match. Inspect the file before using its content.",
    ),
  ).toBeVisible();

  expect(networkRequests).toEqual([]);
  expect(cspErrors).toEqual([]);
});

test("Reader configures and completes a Published Protocol offline on a narrow screen", async ({
  page,
  context,
}, testInfo) => {
  const protocol: Protocol = {
    protocolId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f80",
    title: "Offline Reader",
    sections: [
      {
        sectionId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f81",
        title: "Prepare {{ amount }}",
        markdown:
          "### Materials\n\nPrepare **{{ amount }}** units. [Reference](https://example.com/reference)\n\n- [ ] Confirm the amount.",
        duration: { kind: "untimed" },
        endAction: "advance",
        completionRequirement: "all-task-items",
      },
      {
        sectionId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f82",
        title: "Incubate",
        markdown: "Wait for the timer.",
        duration: { kind: "fixed", seconds: "1" },
        endAction: "wait",
      },
    ],
    variables: [
      {
        kind: "input",
        id: "amount",
        label: "Amount",
        valueType: "numeric",
        minimum: "1",
        maximum: "10",
      },
    ],
    formulaTestCases: [],
  };
  const keys = await ProtocolCore.generateAuthorKeyPair();
  const signature = await ProtocolCore.signProtocol(
    protocol,
    keys.privateKey,
    keys.publicKey,
  );
  const envelope = ProtocolCore.encodeEnvelope({
    documentKind: "protocol-box/published-protocol",
    formatVersion: 1,
    appVersion: "0.0.0",
    protocol,
    signature,
  });
  const applicationHtml = await readFile(
    `${process.cwd()}/dist/index.html`,
    "utf8",
  );
  const dataBlockStart =
    '<script id="protocol-box-data" type="application/octet-stream">';
  const contentStart =
    applicationHtml.indexOf(dataBlockStart) + dataBlockStart.length;
  const contentEnd = applicationHtml.indexOf("</script>", contentStart);
  expect(contentStart).toBeGreaterThan(dataBlockStart.length);
  expect(contentEnd).toBeGreaterThan(contentStart);
  const publishedHtml =
    applicationHtml.slice(0, contentStart) +
    envelope +
    applicationHtml.slice(contentEnd);
  const publishedPath = testInfo.outputPath("reader.html");
  await writeFile(publishedPath, publishedHtml, "utf8");

  const requests: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "open", {
      value: (url: string, target: string, features: string) => {
        Object.defineProperty(window, "__openedExternalLink", {
          configurable: true,
          value: { url, target, features },
        });
        return null;
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 600 });
  await context.setOffline(true);
  await page.goto(pathToFileURL(publishedPath).href);

  await expect(page.getByRole("heading", { name: "Offline Reader" })).toBeVisible();
  const readerScrollViewport = page.locator(
    '[data-reader-scroll] [data-slot="scroll-area-viewport"]',
  );
  await expect(readerScrollViewport).toBeVisible();
  expect(
    await page.locator(".reader-app").evaluate(
      (element) => ({
        height: element.getBoundingClientRect().height,
        position: getComputedStyle(element).position,
      }),
    ),
  ).toEqual({ height: 600, position: "fixed" });
  expect(
    await readerScrollViewport.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await readerScrollViewport.evaluate((element) => {
    element.scrollTop = 500;
  });
  expect(
    await readerScrollViewport.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollTop),
  ).toBe(0);
  await page.setViewportSize({ width: 360, height: 740 });
  await expect(page.getByText("Signature Match", { exact: true })).toBeVisible();
  await expect(page.getByText("Playable Protocol", { exact: true })).toBeVisible();
  await expect(page.getByText(signature.keyId, { exact: true })).toBeVisible();
  const readerProgress = page.getByRole("navigation", {
    name: "Reader progress",
  });
  await expect(readerProgress.locator('[aria-current="step"]')).toHaveText(
    "Configure",
  );
  const storageGroup = page.getByRole("group", {
    name: "Playback Session storage",
  });
  const storageChoices = storageGroup.locator(".storage-choice");
  await expect(storageChoices).toHaveCount(2);
  const storageGeometry = await storageGroup.evaluate((group) => {
    const choices = Array.from(group.querySelectorAll(".storage-choice"));
    const inputs = Array.from(
      group.querySelectorAll<HTMLInputElement>(
        'input[type="radio"], input[type="checkbox"]',
      ),
    );
    return {
      groupWidth: group.getBoundingClientRect().width,
      choiceWidths: choices.map(
        (choice) => choice.getBoundingClientRect().width,
      ),
      inputWidths: inputs.map((input) => input.getBoundingClientRect().width),
    };
  });
  expect(storageGeometry.choiceWidths).toEqual([
    storageGeometry.groupWidth,
    storageGeometry.groupWidth,
  ]);
  expect(Math.max(...storageGeometry.inputWidths)).toBeLessThanOrEqual(20);
  const persistentStorage = storageGroup.getByRole("radio", {
    name: "Persistent on this browser",
  });
  await persistentStorage.focus();
  await persistentStorage.press("Space");
  await expect(storageGroup.getByText("Selected", { exact: true })).toBeVisible();
  const storageConfirmation = storageGroup.getByText(
    "I understand that persistent Playback Session Variable Values are stored as plaintext.",
    { exact: true },
  );
  await expect(storageConfirmation).toBeVisible();
  expect(
    await storageConfirmation
      .locator("..")
      .evaluate((label) => label.getBoundingClientRect().width),
  ).toBe(storageGeometry.groupWidth);
  await storageGroup.getByRole("radio", { name: "Memory only" }).press("Space");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1";
  });
  await page.getByLabel("Amount").fill("3");
  await expect(page.getByRole("button", { name: "Start Playback" })).toBeEnabled();
  await page.getByRole("button", { name: "Start Playback" }).press("Enter");
  await expect(readerProgress.locator('[aria-current="step"]')).toHaveText(
    "Playback",
  );
  await expect(page.getByRole("heading", { name: "Prepare 3" })).toBeVisible();
  const checklistItem = page.getByRole("checkbox", {
    name: "Task item checkbox for Confirm the amount.",
  });
  await expect(checklistItem).not.toBeChecked();
  await checklistItem.focus();
  await checklistItem.press("Space");
  await expect(checklistItem).toBeChecked();
  await checklistItem.press("Space");
  await expect(checklistItem).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Complete Section" }),
  ).toBeDisabled();
  await checklistItem.press("Space");
  await expect(checklistItem).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Complete Section" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() => ({
      horizontal:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      vertical:
        document.documentElement.scrollHeight >
        document.documentElement.clientHeight,
    })),
  ).toEqual({ horizontal: false, vertical: false });
  const readerBodyHeading = page.locator(".section-prose .tiptap h3");
  await expect(readerBodyHeading).toHaveText("Materials");
  expect(
    await readerBodyHeading.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThan(16);
  const jumpButton = page.getByRole("button", { name: "Jump to Incubate" });
  await jumpButton.press("Enter");
  const jumpDialog = page.getByRole("dialog", { name: "Change Section?" });
  await expect(jumpDialog).toBeVisible();
  await expect(
    jumpDialog.getByRole("button", { name: "Change Section" }),
  ).toBeFocused();
  await jumpDialog.getByRole("button", { name: "Cancel" }).press("Escape");
  await expect(jumpDialog).toBeHidden();
  await expect(jumpButton).toBeFocused();

  const referenceLink = page.getByRole("link", { name: "Reference" });
  await referenceLink.press("Enter");
  const externalLinkDialog = page.getByRole("dialog", {
    name: "Open external link?",
  });
  await expect(externalLinkDialog).toBeVisible();
  await expect(
    externalLinkDialog.getByRole("button", { name: "Open link" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    externalLinkDialog.getByRole("button", { name: "Cancel" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    externalLinkDialog.getByRole("button", { name: "Open link" }),
  ).toBeFocused();
  await externalLinkDialog.getByRole("button", { name: "Cancel" }).press("Escape");
  await expect(externalLinkDialog).toBeHidden();
  await expect(referenceLink).toBeFocused();

  await referenceLink.press("Enter");
  await externalLinkDialog.getByRole("button", { name: "Open link" }).press("Enter");
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __openedExternalLink?: {
              url: string;
              target: string;
              features: string;
            };
          }
        ).__openedExternalLink,
    ),
  ).toEqual({
    url: "https://example.com/reference",
    target: "_blank",
    features: "noopener,noreferrer",
  });
  await page.getByRole("button", { name: "Complete Section" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Incubate" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete Section" })).toHaveCount(0);
  const waitDialog = page.getByRole("dialog", {
    name: "Section timer complete",
  });
  await expect(waitDialog).toBeVisible({ timeout: 3_000 });
  const acknowledgeButton = waitDialog.getByRole("button", {
    name: "Acknowledge Section",
  });
  await expect(acknowledgeButton).toBeFocused();
  await acknowledgeButton.press("Escape");
  await expect(waitDialog).toBeVisible();
  await acknowledgeButton.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Completion Summary" }),
  ).toBeVisible();
  await expect(readerProgress.locator('[aria-current="step"]')).toHaveText(
    "Completion",
  );
  await expect(page.getByText("Non-audit personal reference")).toBeVisible();
  const clearSessionButton = page.getByRole("button", {
    name: "Clear Playback Session",
  });
  await clearSessionButton.press("Enter");
  const clearDialog = page.getByRole("dialog", {
    name: "Clear Playback Session?",
  });
  await expect(clearDialog).toBeVisible();
  await expect(
    clearDialog.getByRole("button", { name: "Clear Session" }),
  ).toBeFocused();
  await clearDialog.getByRole("button", { name: "Cancel" }).press("Escape");
  await expect(clearDialog).toBeHidden();
  await expect(clearSessionButton).toBeFocused();
  expect(requests).toEqual([]);
});
