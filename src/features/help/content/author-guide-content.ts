import type { Locale } from "@/locales";

export type AuthorChapterId =
  | "author-key"
  | "unsigned-draft"
  | "sections"
  | "variables"
  | "formulas"
  | "author-preview"
  | "publish-recovery";

export type AuthorScreenshotId =
  | "author-access"
  | "authoring"
  | "publish-readiness";

interface GuideStep {
  title: string;
  body: string;
}

interface GuideRow {
  label: string;
  meaning: string;
  action: string;
}

interface GuideExample {
  title: string;
  body: string;
  code?: string;
}

export interface AuthorGuideChapter {
  id: AuthorChapterId;
  navTitle: string;
  title: string;
  summary: string;
  objective: string;
  uiMap: GuideRow[];
  steps: GuideStep[];
  states: GuideRow[];
  examples: GuideExample[];
  troubleshooting: GuideStep[];
  related: AuthorChapterId[];
  screenshotId?: AuthorScreenshotId;
  screenshotLegend?: GuideRow[];
}

export interface AuthorGuideContent {
  title: string;
  summary: string;
  quickStartTitle: string;
  quickStart: GuideStep[];
  chaptersTitle: string;
  checklistTitle: string;
  checklist: string[];
  labels: {
    objective: string;
    uiMap: string;
    steps: string;
    states: string;
    examples: string;
    troubleshooting: string;
    related: string;
    screenshot: string;
    screenshotUnavailable: string;
    viewScreenshot: string;
    openReference: string;
    tableState: string;
    tableMeaning: string;
    tableAction: string;
  };
  chapters: AuthorGuideChapter[];
}

const english: AuthorGuideContent = {
  title: "Author Guide",
  summary:
    "Create, check, preview, sign, and recover portable Protocols without crossing the boundary between an editable Unsigned Draft and a Published Protocol.",
  quickStartTitle: "Seven-step quick start",
  quickStart: [
    {
      title: "Open Author access",
      body: "Create a new encrypted Key Bundle or open the Key Bundle that already holds your Author Key.",
    },
    {
      title: "Create an Unsigned Draft",
      body: "Start blank or select the buffer-preparation example. Save the Key Bundle separately from the Draft.",
    },
    {
      title: "Write ordered Sections",
      body: "Use the Outline to navigate, the Canvas to write Markdown-backed WYSIWYG content, and the Inspector for Section settings.",
    },
    {
      title: "Define Variables",
      body: "Declare typed Input Variables and Derived Variables, then insert Variable references into Section content.",
    },
    {
      title: "Prove Formula behavior",
      body: "Use Formula Preview for immediate feedback and add signed Formula Test Cases with expected Derived Values.",
    },
    {
      title: "Save and use Author Preview",
      body: "Save explicitly, then inspect Reader configuration and Playback behavior without creating a Playback Session.",
    },
    {
      title: "Resolve readiness and publish",
      body: "Clear every Playable Protocol blocker, sign the current Protocol, and save both the HTML and whole-file SHA-256.",
    },
  ],
  chaptersTitle: "Author Guide chapters",
  checklistTitle: "Before you publish",
  checklist: [
    "The current Unsigned Draft has been saved and the status bar no longer reports unsaved changes.",
    "Section order, titles, timers, end actions, links, images, and tables have been reviewed.",
    "Every Input Variable has the intended type, default, and constraints.",
    "Every Derived Variable has a passing Formula Preview and at least one relevant Formula Test Case.",
    "Author Preview has been checked at narrow and desktop widths using representative Variable Values.",
    "Publish readiness reports a Playable Protocol with no unresolved errors.",
    "The Key Bundle is backed up separately and the intended output filename will not overwrite an important file.",
  ],
  labels: {
    objective: "Goal",
    uiMap: "Interface map",
    steps: "Procedure",
    states: "States and boundaries",
    examples: "Worked example",
    troubleshooting: "If something goes wrong",
    related: "Related chapters",
    screenshot: "Annotated interface screenshot",
    screenshotUnavailable: "Screenshot unavailable in this build",
    viewScreenshot: "View annotated screenshot",
    openReference: "Open reference details",
    tableState: "State",
    tableMeaning: "What it means",
    tableAction: "What to do",
  },
  chapters: [
    {
      id: "author-key",
      navTitle: "Author Key",
      title: "Author Key and access",
      summary: "Keep custody of the signing key before opening encrypted work.",
      objective:
        "Enter Author mode without confusing the Key Bundle Password with the Author Key or treating an Author Key ID as proof of identity.",
      uiMap: [
        {
          label: "Key Bundle Password",
          meaning: "Decrypts a Key Bundle for this session.",
          action: "Use a long, unique value and preserve it separately; it is not an account credential or recovery code.",
        },
        {
          label: "Create New Key Bundle",
          meaning: "Generates a new Author Key and encrypted portable bundle.",
          action: "Save the JSON file immediately and keep another protected copy.",
        },
        {
          label: "Unlock Author Mode",
          meaning: "Opens an existing Key Bundle in memory.",
          action: "Choose the matching JSON and enter its Key Bundle Password.",
        },
      ],
      steps: [
        {
          title: "Create or choose the correct Key Bundle",
          body: "Create a new bundle only for a genuinely new Author Key. To continue an existing publishing identity, open its existing Key Bundle.",
        },
        {
          title: "Enter the Key Bundle password",
          body: "Use a long, unique password and preserve it separately. Someone who obtains the encrypted Key Bundle can attempt offline guesses; the password does not replace, regenerate, or identify the Author Key.",
        },
        {
          title: "Check the Author Key ID through a Trusted Distribution Channel",
          body: "A matching Author Key ID lets collaborators compare the public key they expect. Protocol Box does not decide whether the chosen channel is trustworthy, and the ID does not establish a real-world identity.",
        },
        {
          title: "Preserve protected external copies",
          body: "Keep the portable Key Bundle outside browser storage. A Browser Key Bundle Recovery Copy is browser-local convenience data, may disappear, and cannot replace a protected external copy.",
        },
        {
          title: "Lock when custody changes",
          body: "Use Lock or Save and Lock before another person uses the browser. Locking saves the Draft and removes Protocol Box's references to in-memory key material and decrypted Draft data; it does not claim secure erasure of browser process memory.",
        },
      ],
      states: [
        {
          label: "Locked",
          meaning: "No Author Key is available in memory.",
          action: "Open a Key Bundle before reading matching Drafts.",
        },
        {
          label: "Unlocked",
          meaning: "The Author Key is temporarily available for Draft decryption and signing.",
          action: "Work only on a device and browser session you control.",
        },
        {
          label: "Lost external copies or password",
          meaning: "Protocol Box cannot reconstruct the Author Key.",
          action: "Recover a protected external copy with its password. Creating a new Key Bundle creates a different Author Key ID.",
        },
        {
          label: "Browser recovery copy",
          meaning: "One validated encrypted Key Bundle copy may be retained per Author Key ID in this browser.",
          action: "Treat it as local convenience data, not as a backup or portable custody record.",
        },
        {
          label: "Suspected exposure",
          meaning: "Protocol Box has no key revocation list or remote file revocation.",
          action: "Stop using the key, create a new one, and announce its Author Key ID through a Trusted Distribution Channel.",
        },
      ],
      examples: [
        {
          title: "Custody pattern",
          body: "Keep the working Key Bundle on controlled storage, preserve another protected external copy separately, and distribute only the Author Key ID through a Trusted Distribution Channel.",
        },
        {
          title: "Recovery is not password reset",
          body: "A Browser Key Bundle Recovery Copy contains the same encrypted key material and still requires its Key Bundle Password. Protocol Box has no account or server that can reset it.",
        },
      ],
      troubleshooting: [
        {
          title: "Author mode is disabled",
          body: "Read the persistent capability message. Author mode requires Web Crypto, IndexedDB, and supported local file operations.",
        },
        {
          title: "The password is rejected",
          body: "Confirm that the Key Bundle Password belongs to the selected file. Protocol Box cannot reset it, and repeated guessing cannot reconstruct a forgotten value.",
        },
      ],
      related: ["unsigned-draft", "publish-recovery"],
      screenshotId: "author-access",
      screenshotLegend: [
        {
          label: "1",
          meaning: "Key Bundle password entry",
          action: "Used only for local bundle encryption and decryption.",
        },
        {
          label: "2",
          meaning: "Create path",
          action: "Begins a new Author Key identity.",
        },
        {
          label: "3",
          meaning: "Unlock path",
          action: "Continues work with an existing Author Key.",
        },
      ],
    },
    {
      id: "unsigned-draft",
      navTitle: "Unsigned Draft",
      title: "Unsigned Draft lifecycle",
      summary: "Create, save, restore, import, and close encrypted editable work.",
      objective:
        "Keep editable Protocol work recoverable without mistaking browser storage or recovery snapshots for publication.",
      uiMap: [
        {
          label: "Drafts workspace",
          meaning: "Lists Drafts that the unlocked Author Key can decrypt.",
          action: "Search by decrypted in-memory title or sort by update time.",
        },
        {
          label: "Save",
          meaning: "Encrypts the current Unsigned Draft into browser storage.",
          action: "Use it before Preview, Publish, Lock, or closing the browser.",
        },
        {
          label: "Status bar",
          meaning: "Reports dirty state, save failures, lock state, and readiness.",
          action: "Treat it as authoritative; transient UI is supplementary.",
        },
      ],
      steps: [
        {
          title: "Choose a starting point",
          body: "New Unsigned Draft defaults to a blank Protocol. Select the buffer-preparation example only when you want a complete editable reference.",
        },
        {
          title: "Save explicitly",
          body: "A dirty status means the in-memory Protocol differs from the last encrypted save. Save before depending on browser persistence.",
        },
        {
          title: "Use recovery snapshots carefully",
          body: "Snapshots help recover earlier encrypted states. Restoring one replaces the open working state; inspect it before saving again.",
        },
        {
          title: "Import without confusing identity",
          body: "Importing a Published Protocol preserves its Protocol identity for inspection. Explicit Fork creates a new Protocol identity for independent publication.",
        },
      ],
      states: [
        {
          label: "Unsaved changes",
          meaning: "Current in-memory content differs from the encrypted Draft.",
          action: "Save or explicitly discard before leaving.",
        },
        {
          label: "Save failed",
          meaning: "Browser storage did not accept the encrypted update.",
          action: "Keep the page open, preserve the error message, and retry before locking.",
        },
        {
          label: "Quarantined Draft",
          meaning: "Stored data failed authentication or structural checks.",
          action: "Do not delete it blindly; preserve a copy and use recovery guidance.",
        },
      ],
      examples: [
        {
          title: "Starting from the built-in example",
          body: "Selecting the example creates a normal new Unsigned Draft with new Protocol, Section, Formula Test Case, and Draft identities. Editing it never changes the built-in template.",
        },
      ],
      troubleshooting: [
        {
          title: "A Draft title is not visible",
          body: "Titles are decrypted only after matching Author Key unlock. A quarantined Draft intentionally shows only a short Draft ID.",
        },
        {
          title: "Browser storage was cleared",
          body: "Local Drafts and recovery snapshots may be gone. Clearing data is irreversible unless you separately preserved recoverable files.",
        },
      ],
      related: ["author-key", "sections", "publish-recovery"],
    },
    {
      id: "sections",
      navTitle: "Sections",
      title: "Sections and WYSIWYG authoring",
      summary: "Build the ordered procedure in the three-pane workbench.",
      objective:
        "Write Reader-facing procedure content while keeping structural settings in their owning controls.",
      uiMap: [
        {
          label: "Outline",
          meaning: "Navigates Protocol, Sections, Variables, and Formula Test Cases.",
          action: "Select and reorder structure; do not treat it as a second editor.",
        },
        {
          label: "Canvas",
          meaning: "Edits the selected Section title and Markdown-backed rich content.",
          action: "Use Paragraph or Heading 3-6 for body structure.",
        },
        {
          label: "Inspector",
          meaning: "Edits duration, end action, selected metadata, and image insertion.",
          action: "Keep structured settings out of prose.",
        },
      ],
      steps: [
        {
          title: "Set the hierarchy",
          body: "The Protocol title is Heading 1-level and each Section title is Heading 2-level. Use Heading 3-6 only inside Section bodies.",
        },
        {
          title: "Add and order Sections",
          body: "Add Section inserts after the current Section and focuses its title. Use each Outline row menu or drag-and-drop to reorder.",
        },
        {
          title: "Write and format the procedure",
          body: "Use the floating Block Type menu, emphasis, lists, Task Lists, links, tables, images, and Variable insertion. Markdown remains canonical underneath.",
        },
        {
          title: "Set Playback behavior",
          body: "In the Inspector, choose untimed, fixed, or Derived Variable duration and choose whether the Reader waits or advances.",
        },
      ],
      states: [
        {
          label: "Body Heading 1 or 2 warning",
          meaning: "Imported content conflicts with the intended title hierarchy.",
          action: "Preserve if necessary, but prefer Heading 3-6 for body structure.",
        },
        {
          label: "Final Section deletion",
          meaning: "A working Draft should retain a Section.",
          action: "Confirm replacement with a new empty Untitled Section.",
        },
        {
          label: "Closed Outline or Inspector",
          meaning: "The pane is hidden but not lost.",
          action: "Use the 32px edge rail to reopen it at the persisted width.",
        },
      ],
      examples: [
        {
          title: "Variable reference in prose",
          body: "Insert a Variable from the toolbar instead of typing a Label. The persisted reference uses its stable ID.",
          code: "Add {{ diluentVolume }} mL of diluent.",
        },
      ],
      troubleshooting: [
        {
          title: "The editor looks blank below the first line",
          body: "Click unused Canvas space to place the insertion point at the end. The Canvas grows and the central Author panel owns vertical scrolling.",
        },
        {
          title: "A link has no selected text",
          body: "Apply the URL directly. Protocol Box inserts the URL itself as linked text.",
        },
      ],
      related: ["variables", "formulas", "author-preview"],
      screenshotId: "authoring",
      screenshotLegend: [
        {
          label: "1",
          meaning: "Outline",
          action: "Navigate and order Protocol structure.",
        },
        {
          label: "2",
          meaning: "Formatting toolbar",
          action: "Choose the current block, insert Variables, and format content.",
        },
        {
          label: "3",
          meaning: "Canvas",
          action: "Edit the selected Section.",
        },
        {
          label: "4",
          meaning: "Inspector",
          action: "Edit structured Section settings.",
        },
        {
          label: "5",
          meaning: "Persistent status",
          action: "Check save, lock, and readiness state.",
        },
      ],
    },
    {
      id: "variables",
      navTitle: "Variable Definitions",
      title: "Variable Definitions",
      summary: "Declare typed values before referencing them in content or formulas.",
      objective:
        "Give each Reader-supplied or calculated value a stable ID, clear Label, type, default, and constraints.",
      uiMap: [
        {
          label: "Variable table",
          meaning: "Lists ID, Label, type, and default or Formula.",
          action: "Select a row to edit details in the Inspector.",
        },
        {
          label: "Dependency graph",
          meaning: "Shows numeric references flowing into Derived Variables.",
          action: "Use diagnostic nodes to find missing references or cycles.",
        },
        {
          label: "Variable toolbar menu",
          meaning: "Inserts a stable Variable ID reference into Section content.",
          action: "Create the definition first, then insert it where Readers need the value.",
        },
      ],
      steps: [
        {
          title: "Choose Input or Derived",
          body: "Input Variables receive Reader-supplied Variable Values. Derived Variables calculate Numeric values from other numeric Variables.",
        },
        {
          title: "Separate ID from Label",
          body: "Use a stable code-like ID such as finalVolume. Use a readable Label such as Final volume (mL). Formulas and content references use the ID.",
        },
        {
          title: "Declare type and constraints",
          body: "Text accepts text, Numeric accepts finite decimals and optional min/max, Boolean accepts true/false, and Enum accepts one declared option.",
        },
        {
          title: "Review dependencies",
          body: "The graph is read-only. Fix definitions or Formulas in the table and Inspector rather than drawing edges.",
        },
      ],
      states: [
        {
          label: "Default Value",
          meaning: "Provides an initial Reader value; it is still part of the signed Protocol.",
          action: "Choose a scientifically appropriate default or leave it absent.",
        },
        {
          label: "Unknown reference",
          meaning: "Content or a Formula names an ID with no matching definition.",
          action: "Correct the ID or add the intended Variable Definition.",
        },
        {
          label: "Type mismatch",
          meaning: "A Variable Value does not satisfy the declared type or constraints.",
          action: "Correct the definition or value; do not coerce it in UI code.",
        },
      ],
      examples: [
        {
          title: "Buffer example inputs",
          body: "The built-in Draft defines finalVolume, targetConcentration, and stockConcentration as Numeric Input Variables with stable English IDs and localized Labels.",
        },
      ],
      troubleshooting: [
        {
          title: "The Variable menu is empty",
          body: "Create a Variable Definition in the Variables panel first. The toolbar menu then lists it by Label and ID.",
        },
        {
          title: "A graph node is red or missing",
          body: "Select the connected Derived Variable and inspect its Formula for an unknown ID, invalid syntax, or a cycle.",
        },
      ],
      related: ["sections", "formulas", "author-preview"],
    },
    {
      id: "formulas",
      navTitle: "Formulas and tests",
      title: "Formulas and Formula Test Cases",
      summary: "Calculate deterministic Decimal values and sign expected behavior.",
      objective:
        "Use the constrained Formula language safely, preview calculations, and preserve expected results in Formula Test Cases.",
      uiMap: [
        {
          label: "Formula field",
          meaning: "Stores the constrained expression for a Derived Variable.",
          action: "Use numeric literals, numeric Variable IDs, operators, parentheses, and approved functions.",
        },
        {
          label: "Formula Preview",
          meaning: "Evaluates transient Input Values with Protocol Core.",
          action: "Use it for immediate feedback; it is not persisted evidence.",
        },
        {
          label: "Formula Test Cases",
          meaning: "Store Input Values and expected Derived Values in the Protocol.",
          action: "Add at least one whenever a Derived Variable exists.",
        },
      ],
      steps: [
        {
          title: "Write a constrained expression",
          body: "Use decimal numbers, Variable IDs, + - * /, unary signs, and parentheses. Property access, JavaScript, I/O, and arbitrary functions are rejected.",
        },
        {
          title: "Use approved functions",
          body: "min and max accept numeric arguments. round accepts a value and optional 0-100 decimal places. ceil and floor accept one value.",
        },
        {
          title: "Preview representative inputs",
          body: "Enter numeric preview values and read either the calculated result or the exact structured error from Protocol Core.",
        },
        {
          title: "Add Formula Test Cases",
          body: "Enter JSON objects whose keys are stable Variable IDs. Expected Derived Values must cover the calculations the Author intends to protect.",
        },
      ],
      states: [
        {
          label: "Deterministic Decimal",
          meaning: "Calculations avoid binary floating-point drift and serialize canonical decimal values.",
          action: "Use decimal strings in Formula Test Case JSON.",
        },
        {
          label: "Precision and half-even",
          meaning: "Derived results are rounded to the declared precision using half-even.",
          action: "Choose expectations that match the declared precision.",
        },
        {
          label: "Cycle or division by zero",
          meaning: "The Formula cannot produce a valid value.",
          action: "Break the dependency cycle or revise the denominator before publishing.",
        },
      ],
      examples: [
        {
          title: "Stock volume",
          body: "Calculate the stock portion from final volume and the concentration ratio.",
          code: "round(finalVolume * targetConcentration / stockConcentration, 2)",
        },
        {
          title: "Diluent volume",
          body: "Reference the first Derived Variable from a second Formula.",
          code: "round(finalVolume - stockVolume, 2)",
        },
        {
          title: "Formula Test Case Input Values",
          body: "Use Variable IDs as JSON keys.",
          code: `{
  "finalVolume": "100",
  "targetConcentration": "10",
  "stockConcentration": "100"
}`,
        },
        {
          title: "Expected Derived Values",
          body: "For these inputs, the stock and diluent volumes are 10 and 90.",
          code: `{
  "stockVolume": "10",
  "diluentVolume": "90"
}`,
        },
      ],
      troubleshooting: [
        {
          title: "Unsupported token or function",
          body: "Use only the documented operators and min, max, round, ceil, or floor. Formula source is limited to 2,000 characters.",
        },
        {
          title: "A Formula Test Case fails",
          body: "Compare the actual Derived Values with expected JSON. Decide whether the Formula changed incorrectly or the signed expectation needs deliberate revision.",
        },
      ],
      related: ["variables", "author-preview", "publish-recovery"],
    },
    {
      id: "author-preview",
      navTitle: "Author Preview",
      title: "Author Preview",
      summary: "Inspect Reader behavior without creating a Reader record.",
      objective:
        "Try representative Variable Values and Playback transitions while preserving the boundary between authoring and an actual Playback Session.",
      uiMap: [
        {
          label: "Configure",
          meaning: "Supplies transient Input Variable Values.",
          action: "Use representative boundary and normal values.",
        },
        {
          label: "Playback",
          meaning: "Simulates Section order, timers, acknowledgements, and substitutions.",
          action: "Check behavior without treating it as an experimental execution.",
        },
        {
          label: "Exit Preview",
          meaning: "Returns to the unchanged Author workspace.",
          action: "Save separately if authoring content changed before Preview.",
        },
      ],
      steps: [
        {
          title: "Save the current Draft",
          body: "Preview is most useful when the saved state is known. Unsaved state remains an Author concern, not a Reader session.",
        },
        {
          title: "Configure representative values",
          body: "Check defaults, min/max boundaries, Enum choices, Derived Values, and any Derived Section duration.",
        },
        {
          title: "Walk every Section",
          body: "Review substitutions, responsive layout, timers, wait/advance behavior, external links, and completion flow.",
        },
        {
          title: "Exit and correct the Draft",
          body: "Preview values are discarded. Make corrections in Authoring, update Formula Test Cases where intentional, and preview again.",
        },
      ],
      states: [
        {
          label: "Memory-only",
          meaning: "Preview values and progress are transient.",
          action: "Do not expect resume after exit or reload.",
        },
        {
          label: "No Playback Session",
          meaning: "Author Preview does not create Reader session persistence.",
          action: "Use a Published Protocol for actual Reader Playback.",
        },
        {
          label: "No Completion Summary",
          meaning: "Preview completion cannot produce even the unsigned Reader summary.",
          action: "Do not present Preview as evidence or an experiment record.",
        },
      ],
      examples: [
        {
          title: "Buffer example preview",
          body: "Keep the defaults 100, 10, and 100. Confirm stockVolume resolves to 10 and diluentVolume resolves to 90 throughout the Sections.",
        },
      ],
      troubleshooting: [
        {
          title: "Preview cannot start",
          body: "Return to Authoring or Publish readiness and resolve Protocol structure, Formula, resource, or missing Input constraints.",
        },
        {
          title: "A value disappears after exit",
          body: "This is expected. Author Preview Variable Values are deliberately not stored in the Unsigned Draft or a Playback Session.",
        },
      ],
      related: ["sections", "variables", "formulas", "publish-recovery"],
    },
    {
      id: "publish-recovery",
      navTitle: "Publish and recovery",
      title: "Publish, outputs, and recovery",
      summary: "Resolve readiness, sign immutable content, and preserve both outputs.",
      objective:
        "Publish the intended saved Protocol and understand exactly what each fingerprint, signature, and file proves.",
      uiMap: [
        {
          label: "Readiness",
          meaning: "Reports Playable Protocol status and exact blockers.",
          action: "Resolve every blocking error before publication.",
        },
        {
          label: "Output",
          meaning: "Chooses the Published Protocol HTML filename.",
          action: "Prefer a new descriptive filename rather than overwriting.",
        },
        {
          label: "Publish",
          meaning: "Signs the current Protocol and opens guarded file saving.",
          action: "Save both HTML and its whole-file SHA-256.",
        },
      ],
      steps: [
        {
          title: "Save first",
          body: "Publish is disabled while the Draft has unsaved changes. Confirm the intended title, identity, Sections, Variables, and Formula Test Cases.",
        },
        {
          title: "Resolve Playable Protocol checks",
          body: "Format, resource bounds, formulas, Formula Test Cases, and required content must pass. A heading warning may remain non-blocking.",
        },
        {
          title: "Sign and save",
          body: "Publication signs the canonical Protocol with the unlocked Author Key and creates a self-contained HTML plus whole-file SHA-256.",
        },
        {
          title: "Record and distribute identifiers",
          body: "Distribute the HTML, checksum, Protocol Fingerprint, and Author Key ID through channels appropriate to your verification process.",
        },
      ],
      states: [
        {
          label: "Signature Match",
          meaning: "Signed Protocol content matches the embedded Author Key.",
          action: "Do not describe it as verified real-world Author identity.",
        },
        {
          label: "Protocol Fingerprint",
          meaning: "Identifies the complete canonical Protocol content.",
          action: "Use it to distinguish published Protocol versions.",
        },
        {
          label: "Whole-file SHA-256",
          meaning: "Identifies the exact distributed HTML bytes.",
          action: "Keep it beside the matching HTML; changing any file byte changes it.",
        },
      ],
      examples: [
        {
          title: "Two different identifiers",
          body: "The Protocol Fingerprint follows canonical Protocol content. The whole-file SHA-256 follows the complete HTML artifact. They serve different comparison jobs.",
        },
      ],
      troubleshooting: [
        {
          title: "The file picker is cancelled or saving fails",
          body: "The Draft remains editable. Keep the page open, choose a safe new filename, and retry. Do not claim publication succeeded until both files are saved.",
        },
        {
          title: "A recovery snapshot is needed",
          body: "Restoring replaces the open working state. Preserve the current state first when possible, inspect the restored Protocol, then save deliberately.",
        },
        {
          title: "A destructive reset is suggested",
          body: "Before clearing storage, deleting a Draft, or replacing a Key Bundle, identify what will be lost and preserve every available backup or recovery file.",
        },
      ],
      related: ["author-key", "unsigned-draft", "author-preview"],
      screenshotId: "publish-readiness",
      screenshotLegend: [
        {
          label: "1",
          meaning: "Readiness status",
          action: "Separates blocking errors from non-blocking warnings.",
        },
        {
          label: "2",
          meaning: "Output filename",
          action: "Names the self-contained Published Protocol HTML.",
        },
        {
          label: "3",
          meaning: "Publish action",
          action: "Signs and starts guarded file saving.",
        },
        {
          label: "4",
          meaning: "Recovery snapshots",
          action: "Restores an earlier encrypted Draft state deliberately.",
        },
      ],
    },
  ],
};

const simplifiedChinese: AuthorGuideContent = {
  title: "作者指南",
  summary:
    "创建、检查、预览、签署并恢复便携实验规程，同时严格区分可编辑的未签名草稿和已发布规程。",
  quickStartTitle: "七步快速入门",
  quickStart: [
    {
      title: "打开作者访问",
      body: "创建新的加密密钥包，或打开已经保管作者密钥的密钥包。",
    },
    {
      title: "创建未签名草稿",
      body: "从空白开始，或选择缓冲液配制示例。密钥包应与草稿分开保存。",
    },
    {
      title: "编写有序步骤",
      body: "使用大纲导航、在画布中编写以 Markdown 持久化的所见即所得内容，并在检查器中设置步骤属性。",
    },
    {
      title: "定义变量",
      body: "声明有类型的输入变量和派生变量，再把变量引用插入步骤正文。",
    },
    {
      title: "证明公式行为",
      body: "用公式预览获得即时反馈，并添加包含预期派生值的已签名公式测试用例。",
    },
    {
      title: "保存并使用作者预览",
      body: "显式保存，然后检查阅读者配置和导引行为，但不创建导引会话。",
    },
    {
      title: "解决就绪问题并发布",
      body: "解决所有可导引规程阻塞项，签署当前规程，并保存 HTML 和整文件 SHA-256。",
    },
  ],
  chaptersTitle: "作者指南章节",
  checklistTitle: "发布前检查",
  checklist: [
    "当前未签名草稿已经保存，状态栏不再显示未保存更改。",
    "已检查步骤顺序、标题、计时、结束动作、链接、图像和表格。",
    "每个输入变量都具有预期的类型、默认值和约束。",
    "每个派生变量的公式预览通过，并至少有一个相关公式测试用例。",
    "已用代表性变量值在窄屏和桌面宽度下检查作者预览。",
    "发布就绪显示可导引规程，且没有未解决错误。",
    "密钥包已分开备份，输出文件名不会覆盖重要文件。",
  ],
  labels: {
    objective: "本章目标",
    uiMap: "界面地图",
    steps: "操作步骤",
    states: "状态与边界",
    examples: "完整示例",
    troubleshooting: "出现问题时",
    related: "相关章节",
    screenshot: "标注界面截图",
    screenshotUnavailable: "此构建未配置截图",
    viewScreenshot: "查看标注截图",
    openReference: "展开参考详情",
    tableState: "状态",
    tableMeaning: "含义",
    tableAction: "如何处理",
  },
  chapters: [
    {
      id: "author-key",
      navTitle: "作者密钥",
      title: "作者密钥与访问",
      summary: "在打开加密工作前妥善保管签名密钥。",
      objective:
        "进入作者模式，同时避免把密钥包密码等同于作者密钥，也不把作者密钥 ID 当作身份证明。",
      uiMap: [
        {
          label: "密钥包密码",
          meaning: "为当前会话解密密钥包。",
          action: "使用长且唯一的值并单独保存；它不是账户凭据或恢复码。",
        },
        {
          label: "创建新密钥包",
          meaning: "生成新作者密钥和加密便携密钥包。",
          action: "立即保存 JSON 文件，并在其他受保护位置保留备份。",
        },
        {
          label: "解锁作者模式",
          meaning: "把现有密钥包临时打开到内存。",
          action: "选择匹配的 JSON 并输入其密钥包密码。",
        },
      ],
      steps: [
        {
          title: "创建或选择正确的密钥包",
          body: "只有确实需要新作者密钥时才创建新包。要延续现有发布身份，应打开原有密钥包。",
        },
        {
          title: "输入密钥包密码",
          body: "使用长且唯一的密码并单独保存。取得加密密钥包的人可以离线尝试猜测；密码不会替代、重新生成或标识作者密钥。",
        },
        {
          title: "通过可信分发渠道核对作者密钥 ID",
          body: "匹配的作者密钥 ID 便于协作者比较预期公钥。Protocol Box 不判断所选渠道是否可信，该 ID 也不能确认现实身份。",
        },
        {
          title: "保留受保护的外部副本",
          body: "在浏览器存储之外保管便携密钥包。浏览器密钥包恢复副本只是可能消失的本地便利数据，不能替代受保护的外部副本。",
        },
        {
          title: "保管责任变化时锁定",
          body: "他人使用浏览器前执行锁定或保存并锁定。锁定会保存草稿，并移除 Protocol Box 对内存密钥材料和已解密草稿数据的引用；它不承诺安全擦除浏览器进程内存。",
        },
      ],
      states: [
        {
          label: "已锁定",
          meaning: "内存中没有可用作者密钥。",
          action: "打开密钥包后才能读取匹配草稿。",
        },
        {
          label: "已解锁",
          meaning: "作者密钥临时用于解密草稿和签名。",
          action: "仅在自己控制的设备和浏览器会话中工作。",
        },
        {
          label: "外部副本或密码丢失",
          meaning: "Protocol Box 无法重建作者密钥。",
          action: "使用密码恢复受保护的外部副本。创建新密钥包会产生不同的作者密钥 ID。",
        },
        {
          label: "浏览器恢复副本",
          meaning: "此浏览器可为每个作者密钥 ID 保留一个已经验证的加密密钥包副本。",
          action: "只把它视为本地便利数据，不要当作备份或便携保管记录。",
        },
        {
          label: "疑似泄露",
          meaning: "Protocol Box 不提供密钥撤销列表或远程文件撤销。",
          action: "停止使用该密钥，创建新密钥，并通过可信分发渠道公布新的作者密钥 ID。",
        },
      ],
      examples: [
        {
          title: "保管方式",
          body: "在受控存储中保留工作密钥包，在其他位置保留受保护的外部副本，只通过可信分发渠道分发作者密钥 ID。",
        },
        {
          title: "恢复不等于重置密码",
          body: "浏览器密钥包恢复副本包含相同的加密密钥材料，仍需要密钥包密码。Protocol Box 没有可为其重置密码的账户或服务器。",
        },
      ],
      troubleshooting: [
        {
          title: "作者模式被禁用",
          body: "阅读持久能力消息。作者模式需要 Web Crypto、IndexedDB 和受支持的本地文件操作。",
        },
        {
          title: "密码被拒绝",
          body: "确认密钥包密码属于所选文件。Protocol Box 无法重置密码，反复猜测也不能重建忘记的值。",
        },
      ],
      related: ["unsigned-draft", "publish-recovery"],
      screenshotId: "author-access",
      screenshotLegend: [
        {
          label: "1",
          meaning: "密钥包密码",
          action: "仅用于本地加密和解密密钥包。",
        },
        {
          label: "2",
          meaning: "创建路径",
          action: "开始新的作者密钥身份。",
        },
        {
          label: "3",
          meaning: "解锁路径",
          action: "使用现有作者密钥继续工作。",
        },
      ],
    },
    {
      id: "unsigned-draft",
      navTitle: "未签名草稿",
      title: "未签名草稿生命周期",
      summary: "创建、保存、恢复、导入和关闭加密的可编辑工作。",
      objective:
        "让可编辑规程保持可恢复，同时不把浏览器存储或恢复快照误认为发布。",
      uiMap: [
        {
          label: "草稿工作区",
          meaning: "列出已解锁作者密钥能够解密的草稿。",
          action: "按内存中解密的标题搜索，或按更新时间排序。",
        },
        {
          label: "保存",
          meaning: "把当前未签名草稿加密写入浏览器存储。",
          action: "预览、发布、锁定或关闭浏览器前执行保存。",
        },
        {
          label: "状态栏",
          meaning: "报告未保存、保存失败、锁定和就绪状态。",
          action: "以它为权威反馈；瞬时 UI 只作补充。",
        },
      ],
      steps: [
        {
          title: "选择起点",
          body: "新建未签名草稿默认从空白规程开始。需要完整可编辑参考时才选择缓冲液配制示例。",
        },
        {
          title: "显式保存",
          body: "未保存状态表示内存规程与最近一次加密保存不同。依赖浏览器持久化前必须保存。",
        },
        {
          title: "谨慎使用恢复快照",
          body: "快照可恢复较早的加密状态。恢复会替换当前打开状态，再次保存前先检查内容。",
        },
        {
          title: "不要混淆导入与身份",
          body: "导入已发布规程时保留其规程身份供检查；显式派生副本会创建新规程身份用于独立发布。",
        },
      ],
      states: [
        {
          label: "未保存更改",
          meaning: "当前内存内容与加密草稿不同。",
          action: "离开前保存或明确丢弃。",
        },
        {
          label: "保存失败",
          meaning: "浏览器存储未接受加密更新。",
          action: "保持页面打开，保留错误消息，锁定前重试。",
        },
        {
          label: "草稿已隔离",
          meaning: "存储数据未通过认证或结构检查。",
          action: "不要盲目删除；保留副本并按恢复说明处理。",
        },
      ],
      examples: [
        {
          title: "从内置示例开始",
          body: "选择示例会创建普通的新未签名草稿，并生成新的规程、步骤、公式测试用例和草稿身份。编辑它不会修改内置模板。",
        },
      ],
      troubleshooting: [
        {
          title: "看不到草稿标题",
          body: "只有匹配作者密钥解锁后才解密标题。已隔离草稿只显示简短草稿 ID。",
        },
        {
          title: "浏览器存储被清除",
          body: "本地草稿和恢复快照可能已经丢失。除非另有可恢复文件，清除数据不可逆。",
        },
      ],
      related: ["author-key", "sections", "publish-recovery"],
    },
    {
      id: "sections",
      navTitle: "规程步骤",
      title: "规程步骤与所见即所得编写",
      summary: "在三栏工作台中构建有序实验程序。",
      objective: "编写面向阅读者的程序内容，并让结构化设置留在所属控件中。",
      uiMap: [
        {
          label: "大纲",
          meaning: "导航实验规程、步骤、变量和公式测试用例。",
          action: "选择和排序结构，不要把它当作第二个编辑器。",
        },
        {
          label: "画布",
          meaning: "编辑所选步骤标题和以 Markdown 持久化的富文本。",
          action: "正文使用段落或三级至六级标题。",
        },
        {
          label: "检查器",
          meaning: "编辑时长、结束动作、所选元数据和图像插入。",
          action: "不要把结构化设置写进正文。",
        },
      ],
      steps: [
        {
          title: "设置标题层级",
          body: "规程标题对应一级标题，每个步骤标题对应二级标题。步骤正文只使用三级至六级标题。",
        },
        {
          title: "添加并排序步骤",
          body: "添加步骤会插入当前步骤之后并聚焦标题。使用大纲行菜单或拖放重新排序。",
        },
        {
          title: "编写并格式化程序",
          body: "使用浮动块类型菜单、强调、列表、任务列表、链接、表格、图像和变量插入。底层仍以 Markdown 为准。",
        },
        {
          title: "设置导引行为",
          body: "在检查器中选择无计时、固定时长或派生变量时长，并选择等待确认或自动前进。",
        },
      ],
      states: [
        {
          label: "正文一级或二级标题警告",
          meaning: "导入内容与预期标题层级冲突。",
          action: "必要时可保留，但正文应优先使用三级至六级标题。",
        },
        {
          label: "删除最后一个步骤",
          meaning: "工作草稿应保留一个步骤。",
          action: "确认后替换为新的空白未命名步骤。",
        },
        {
          label: "大纲或检查器已关闭",
          meaning: "窗格被隐藏但没有丢失。",
          action: "使用 32px 边缘栏按持久宽度重新打开。",
        },
      ],
      examples: [
        {
          title: "正文中的变量引用",
          body: "从工具栏插入变量，不要手工输入 Label。持久引用使用稳定 ID。",
          code: "加入 {{ diluentVolume }} mL 稀释液。",
        },
      ],
      troubleshooting: [
        {
          title: "第一行下方看起来不可编辑",
          body: "点击画布空白处把插入点放到文末。画布会增长，中央作者面板负责纵向滚动。",
        },
        {
          title: "链接没有选中文字",
          body: "直接应用 URL，Protocol Box 会把 URL 本身插入为链接文字。",
        },
      ],
      related: ["variables", "formulas", "author-preview"],
      screenshotId: "authoring",
      screenshotLegend: [
        { label: "1", meaning: "大纲", action: "导航和排序规程结构。" },
        {
          label: "2",
          meaning: "格式工具栏",
          action: "选择当前块、插入变量和格式化内容。",
        },
        { label: "3", meaning: "画布", action: "编辑所选步骤。" },
        { label: "4", meaning: "检查器", action: "编辑步骤结构化设置。" },
        {
          label: "5",
          meaning: "持久状态",
          action: "检查保存、锁定和就绪状态。",
        },
      ],
    },
    {
      id: "variables",
      navTitle: "变量定义",
      title: "变量定义",
      summary: "先声明有类型的值，再在正文或公式中引用。",
      objective: "为阅读者提供或计算的每个值设置稳定 ID、清晰 Label、类型、默认值和约束。",
      uiMap: [
        {
          label: "变量表",
          meaning: "列出 ID、Label、类型、默认值或公式。",
          action: "选择行后在检查器中编辑详情。",
        },
        {
          label: "依赖图",
          meaning: "显示流向派生变量的数字引用。",
          action: "使用诊断节点查找缺失引用或循环。",
        },
        {
          label: "变量工具栏菜单",
          meaning: "把稳定变量 ID 引用插入步骤正文。",
          action: "先创建定义，再插入阅读者需要该值的位置。",
        },
      ],
      steps: [
        {
          title: "选择输入或派生",
          body: "输入变量接收阅读者提供的变量值；派生变量从其他数字变量计算数字值。",
        },
        {
          title: "区分 ID 与 Label",
          body: "使用 finalVolume 这样的稳定代码式 ID，使用“最终体积（mL）”这样的可读 Label。公式和正文引用使用 ID。",
        },
        {
          title: "声明类型与约束",
          body: "文本接受字符串；数字接受有限小数和可选最小/最大值；布尔接受真/假；枚举接受一个声明选项。",
        },
        {
          title: "检查依赖",
          body: "依赖图只读。应在表格和检查器中修改定义或公式，而不是绘制连线。",
        },
      ],
      states: [
        {
          label: "默认变量值",
          meaning: "为阅读者提供初始值，并属于已签名规程。",
          action: "选择科学上合适的默认值，或不设置。",
        },
        {
          label: "未知引用",
          meaning: "正文或公式使用了没有匹配定义的 ID。",
          action: "修正 ID 或添加预期变量定义。",
        },
        {
          label: "类型不匹配",
          meaning: "变量值不符合声明类型或约束。",
          action: "修正定义或值，不要在 UI 代码中强制转换。",
        },
      ],
      examples: [
        {
          title: "缓冲液示例输入",
          body: "内置草稿把 finalVolume、targetConcentration 和 stockConcentration 定义为数字输入变量，英文 ID 稳定，Label 随界面语言本地化。",
        },
      ],
      troubleshooting: [
        {
          title: "变量菜单为空",
          body: "先在变量面板创建变量定义，工具栏菜单随后会按 Label 和 ID 列出。",
        },
        {
          title: "依赖图节点变红或缺失",
          body: "选择连接的派生变量，检查公式中是否存在未知 ID、无效语法或循环。",
        },
      ],
      related: ["sections", "formulas", "author-preview"],
    },
    {
      id: "formulas",
      navTitle: "公式与测试",
      title: "公式与公式测试用例",
      summary: "计算确定性 Decimal 值，并把预期行为纳入签名。",
      objective: "安全使用受限公式语言、预览计算，并用公式测试用例保存预期结果。",
      uiMap: [
        {
          label: "公式字段",
          meaning: "保存派生变量的受限表达式。",
          action: "使用数字、数字变量 ID、运算符、括号和允许函数。",
        },
        {
          label: "公式预览",
          meaning: "使用规程核心和临时输入值求值。",
          action: "用于即时反馈，不作为持久证据。",
        },
        {
          label: "公式测试用例",
          meaning: "在规程中保存输入值和预期派生值。",
          action: "存在派生变量时至少添加一个。",
        },
      ],
      steps: [
        {
          title: "编写受限表达式",
          body: "使用小数、变量 ID、+ - * /、一元正负号和括号。属性访问、JavaScript、I/O 和任意函数都会被拒绝。",
        },
        {
          title: "使用允许函数",
          body: "min 和 max 接受数字参数；round 接受值和可选的 0-100 位小数；ceil 和 floor 各接受一个值。",
        },
        {
          title: "预览代表性输入",
          body: "输入数字预览值，读取规程核心给出的计算结果或精确结构化错误。",
        },
        {
          title: "添加公式测试用例",
          body: "输入以稳定变量 ID 为键的 JSON 对象。预期派生值应覆盖作者希望保护的计算。",
        },
      ],
      states: [
        {
          label: "确定性 Decimal",
          meaning: "计算避免二进制浮点漂移，并序列化规范小数值。",
          action: "公式测试用例 JSON 使用小数字符串。",
        },
        {
          label: "精度与 half-even",
          meaning: "派生结果按声明精度使用 half-even 舍入。",
          action: "让预期结果与声明精度一致。",
        },
        {
          label: "循环或除零",
          meaning: "公式无法产生有效值。",
          action: "发布前打破依赖循环或修正分母。",
        },
      ],
      examples: [
        {
          title: "储备液体积",
          body: "根据最终体积和浓度比计算储备液份额。",
          code: "round(finalVolume * targetConcentration / stockConcentration, 2)",
        },
        {
          title: "稀释液体积",
          body: "第二个公式引用第一个派生变量。",
          code: "round(finalVolume - stockVolume, 2)",
        },
        {
          title: "公式测试用例输入值",
          body: "使用变量 ID 作为 JSON 键。",
          code: `{
  "finalVolume": "100",
  "targetConcentration": "10",
  "stockConcentration": "100"
}`,
        },
        {
          title: "预期派生值",
          body: "对上述输入，储备液和稀释液体积分别为 10 和 90。",
          code: `{
  "stockVolume": "10",
  "diluentVolume": "90"
}`,
        },
      ],
      troubleshooting: [
        {
          title: "不支持的 token 或函数",
          body: "只使用文档中的运算符和 min、max、round、ceil、floor。公式源最多 2,000 字符。",
        },
        {
          title: "公式测试用例失败",
          body: "比较实际派生值和预期 JSON，判断是公式意外改变，还是需要有意修改已签名预期。",
        },
      ],
      related: ["variables", "author-preview", "publish-recovery"],
    },
    {
      id: "author-preview",
      navTitle: "作者预览",
      title: "作者预览",
      summary: "检查阅读者行为，但不创建阅读者记录。",
      objective: "尝试代表性变量值和导引转换，同时保持作者工作与实际导引会话的边界。",
      uiMap: [
        {
          label: "配置",
          meaning: "提供临时输入变量值。",
          action: "使用正常值和边界值。",
        },
        {
          label: "导引",
          meaning: "模拟步骤顺序、计时、确认和替换。",
          action: "检查行为，但不要把它视为实验执行。",
        },
        {
          label: "退出预览",
          meaning: "返回未改变的作者工作区。",
          action: "若预览前更改过编写内容，应另行保存。",
        },
      ],
      steps: [
        {
          title: "保存当前草稿",
          body: "已知保存状态时预览最有意义。未保存状态仍属于作者工作，不是阅读者会话。",
        },
        {
          title: "配置代表性值",
          body: "检查默认值、最小/最大边界、枚举选项、派生值和派生步骤时长。",
        },
        {
          title: "遍历所有步骤",
          body: "检查变量替换、响应式布局、计时、等待/前进、外部链接和完成流程。",
        },
        {
          title: "退出并修正草稿",
          body: "预览值会被丢弃。在编写区修正内容，有意变更时更新公式测试用例，然后再次预览。",
        },
      ],
      states: [
        {
          label: "仅内存",
          meaning: "预览值和进度是临时的。",
          action: "退出或重载后不能恢复。",
        },
        {
          label: "不创建导引会话",
          meaning: "作者预览不创建阅读者会话持久化。",
          action: "实际阅读者导引应使用已发布规程。",
        },
        {
          label: "不创建完成摘要",
          meaning: "预览完成后也不能生成未签名阅读者摘要。",
          action: "不得把预览描述为证据或实验记录。",
        },
      ],
      examples: [
        {
          title: "缓冲液示例预览",
          body: "保留默认值 100、10、100，确认 stockVolume 为 10、diluentVolume 为 90，并在全部步骤中正确显示。",
        },
      ],
      troubleshooting: [
        {
          title: "无法开始预览",
          body: "返回编写或发布就绪，解决规程结构、公式、资源或输入约束问题。",
        },
        {
          title: "退出后变量值消失",
          body: "这是预期行为。作者预览变量值不会写入未签名草稿或导引会话。",
        },
      ],
      related: ["sections", "variables", "formulas", "publish-recovery"],
    },
    {
      id: "publish-recovery",
      navTitle: "发布与恢复",
      title: "发布、输出与恢复",
      summary: "解决就绪问题、签署不可变内容并保存两项输出。",
      objective: "发布预期的已保存规程，并准确理解每个指纹、签名和文件所证明的内容。",
      uiMap: [
        {
          label: "就绪",
          meaning: "报告可导引规程状态和准确阻塞项。",
          action: "发布前解决全部阻塞错误。",
        },
        {
          label: "输出",
          meaning: "选择已发布规程 HTML 文件名。",
          action: "优先使用新的描述性文件名，避免覆盖。",
        },
        {
          label: "发布",
          meaning: "签署当前规程并打开受保护文件保存。",
          action: "同时保存 HTML 和整文件 SHA-256。",
        },
      ],
      steps: [
        {
          title: "先保存",
          body: "草稿有未保存更改时不能发布。确认预期标题、身份、步骤、变量和公式测试用例。",
        },
        {
          title: "解决可导引规程检查",
          body: "格式、资源限制、公式、公式测试用例和必需内容必须通过。标题警告可以保持非阻塞。",
        },
        {
          title: "签署并保存",
          body: "发布使用已解锁作者密钥签署规范规程，并创建自包含 HTML 和整文件 SHA-256。",
        },
        {
          title: "记录并分发标识",
          body: "通过适合验证流程的渠道分发 HTML、校验和、规程指纹和作者密钥 ID。",
        },
      ],
      states: [
        {
          label: "签名匹配",
          meaning: "已签名规程内容与嵌入作者密钥匹配。",
          action: "不得描述为已验证现实作者身份。",
        },
        {
          label: "规程指纹",
          meaning: "标识完整规范规程内容。",
          action: "用于区分不同已发布规程版本。",
        },
        {
          label: "整文件 SHA-256",
          meaning: "标识所分发 HTML 的精确字节。",
          action: "与匹配 HTML 一同保存；任一字节变化都会改变它。",
        },
      ],
      examples: [
        {
          title: "两种不同标识",
          body: "规程指纹跟随规范规程内容；整文件 SHA-256 跟随完整 HTML 制品。两者用途不同。",
        },
      ],
      troubleshooting: [
        {
          title: "取消文件选择或保存失败",
          body: "草稿仍可编辑。保持页面打开，选择安全的新文件名后重试。两项文件均保存前不得声称发布成功。",
        },
        {
          title: "需要恢复快照",
          body: "恢复会替换当前打开状态。尽可能先保留当前状态，检查恢复后的规程，再有意保存。",
        },
        {
          title: "建议执行破坏性重置",
          body: "清除存储、删除草稿或替换密钥包前，先确认将丢失什么，并保留所有可用备份或恢复文件。",
        },
      ],
      related: ["author-key", "unsigned-draft", "author-preview"],
      screenshotId: "publish-readiness",
      screenshotLegend: [
        {
          label: "1",
          meaning: "就绪状态",
          action: "区分阻塞错误和非阻塞警告。",
        },
        {
          label: "2",
          meaning: "输出文件名",
          action: "命名自包含已发布规程 HTML。",
        },
        {
          label: "3",
          meaning: "发布操作",
          action: "签名并开始受保护文件保存。",
        },
        {
          label: "4",
          meaning: "恢复快照",
          action: "有意恢复较早的加密草稿状态。",
        },
      ],
    },
  ],
};

export const authorGuideContent: Record<Locale, AuthorGuideContent> = {
  en: english,
  "zh-CN": simplifiedChinese,
};
