export const author = {
  "author.heading": "Protocol Box",
  "author.subtitle": "Scientific publishing workbench",
  "author.nav.label": "Author workspace areas",
  "author.nav.drafts": "Drafts",
  "author.nav.authoring": "Authoring",
  "author.nav.publish": "Publish",
  "author.nav.toggle": "Toggle Author navigation",
  "author.action.save": "Save",
  "author.action.saveLock": "Save and Lock",
  "author.action.preview": "Preview",
  "author.action.newDraft": "New Unsigned Draft",
  "author.action.openDraft": "Open Draft",
  "author.action.lock": "Lock",
  "author.action.createDraft": "Create Unsigned Draft",
  "author.draft.startExample": "Start with buffer preparation example",
  "author.draft.startExampleHelp":
    "Creates a normal editable Unsigned Draft with example Sections, Variables, Formulas, and a Formula Test Case.",
  "author.draft.dialogIntro":
    "Name the Protocol and choose a starting point. This creates an Unsigned Draft; nothing is signed or published yet.",
  "author.draft.titleLabel": "Protocol title",
  "author.draft.titleHelp":
    "You can change this title later in the Authoring workspace.",
  "author.draft.titleRequired": "Enter a Protocol title.",
  "author.draft.startingPoint": "Starting point",
  "author.draft.blankTitle": "Blank Protocol",
  "author.draft.blankDescription":
    "Start with one empty Section and build the procedure yourself.",
  "author.draft.exampleTitle": "Buffer preparation example",
  "author.draft.exampleDescription":
    "Explore an editable example with Sections, Variables, Formulas, a Formula Test, and a checklist.",
  "author.access.eyebrow": "Author access",
  "author.access.title": "Author Key",
  "author.access.intro":
    "Unlock a portable Key Bundle or create one to access encrypted Unsigned Drafts.",
  "author.recovery.eyebrow": "Browser recovery",
  "author.recovery.title": "Browser Key Bundle Recovery Copies",
  "author.recovery.intro":
    "These encrypted Key Bundle JSON copies are retained in this browser's IndexedDB. They are not a reliable backup.",
  "author.recovery.none":
    "No browser recovery copies are available. This does not mean that no external Key Bundle exists.",
  "author.recovery.requiredTitle": "No browser recovery copy",
  "author.recovery.requiredBody":
    "This Unsigned Draft requires Author Key {keyId}. Import and unlock the matching Key Bundle; Protocol Box cannot generate one from a Key ID.",
  "author.recovery.select": "Select recovery copy",
  "author.recovery.keyId": "Author Key ID",
  "author.recovery.savedAt": "Saved {time}",
  "author.recovery.sourceFile": "Imported from {fileName}",
  "author.recovery.unlockSelected": "Unlock selected Key Bundle",
  "author.recovery.openFile": "Open Key Bundle file",
  "author.recovery.importMatching": "Import matching Key Bundle",
  "author.recovery.openAnother": "Open another Key Bundle JSON",
  "author.recovery.createNew": "Create new Author Key",
  "author.recovery.createTitle": "Create Author Key",
  "author.recovery.createIntro":
    "Choose a password for the encrypted Key Bundle. You will need it to unlock this Author Key.",
  "author.recovery.password": "Key Bundle password",
  "author.recovery.confirmPassword": "Confirm Key Bundle password",
  "author.recovery.passwordRequired": "Enter a Key Bundle password.",
  "author.recovery.passwordMismatch": "The Key Bundle passwords do not match.",
  "author.recovery.convertExisting": "Convert an existing Author Key",
  "author.recovery.privateKey": "PKCS#8 private key (base64url)",
  "author.recovery.publicKey": "SPKI public key (base64url)",
  "author.recovery.createAction": "Create New Key Bundle",
  "author.recovery.importTitle": "Open Key Bundle JSON",
  "author.recovery.importIntro":
    "Select an encrypted Key Bundle JSON file. It is cached only after a successful unlock.",
  "author.recovery.fileInput": "Key Bundle JSON file",
  "author.recovery.fileUnavailable":
    "Opening Key Bundle files is unavailable in this browser.",
  "author.recovery.fileInputUnavailable": "The Key Bundle file input is unavailable.",
  "author.recovery.fileTextUnavailable":
    "File.text() and FileReader are unavailable.",
  "author.recovery.fileNoText": "The Key Bundle file did not produce text.",
  "author.recovery.clipboardUnavailable": "The Clipboard API is unavailable.",
  "author.recovery.fileReadFailed": "The Key Bundle file could not be read: {message}",
  "author.recovery.fileReadUnknown": "The Key Bundle file could not be read.",
  "author.recovery.invalidJson":
    "The selected file does not contain valid JSON: {message}",
  "author.recovery.imported": "Key Bundle JSON loaded. Enter its password to unlock it.",
  "author.recovery.unlockImported": "Unlock Key Bundle",
  "author.recovery.passwordFailed":
    "The Key Bundle password or authenticated contents are invalid.",
  "author.recovery.unlockLost": "The Author Key did not remain unlocked.",
  "author.recovery.malformed":
    "The Key Bundle is unsupported or malformed.",
  "author.recovery.keyMismatch":
    "The unlocked Key Bundle does not match the Author Key required by this Unsigned Draft.",
  "author.recovery.replacementTitle": "Replace Browser Recovery Copy?",
  "author.recovery.replacementBody":
    "A different validated Key Bundle JSON already exists for this Author Key. Replace only the browser recovery copy; external JSON files and encrypted Unsigned Drafts will not change.",
  "author.recovery.replace": "Replace recovery copy",
  "author.recovery.keepExisting": "Keep existing copy",
  "author.recovery.replaced": "Browser Key Bundle Recovery Copy replaced.",
  "author.recovery.cached": "Browser Key Bundle Recovery Copy cached.",
  "author.recovery.replacementCancelled":
    "The existing browser recovery copy was kept.",
  "author.recovery.exportWarning":
    "This JSON contains encrypted private-key material. Keep it in a safe external location.",
  "author.recovery.downloadJson": "Download JSON",
  "author.recovery.copyJson": "Copy JSON",
  "author.recovery.copyKeyId": "Copy Author Key ID",
  "author.recovery.downloaded":
    "Key Bundle JSON download started. The external copy has not been verified.",
  "author.recovery.copied":
    "Key Bundle JSON copied. The external copy has not been verified.",
  "author.recovery.copyFailed": "Could not copy Key Bundle JSON: {message}",
  "author.recovery.downloadFailed":
    "Could not download Key Bundle JSON: {message}",
  "author.recovery.keyIdCopied": "Author Key ID copied.",
  "author.recovery.keyIdCopyFailed": "Could not copy Author Key ID: {message}",
  "author.recovery.retrievalFailed":
    "Could not retrieve the Browser Key Bundle Recovery Copy: {message}",
  "author.recovery.forget": "Forget recovery copy",
  "author.recovery.forgetAll": "Forget all recovery copies",
  "author.recovery.forgetTitle": "Forget Browser Recovery Copy?",
  "author.recovery.forgetAllTitle": "Forget all Browser Recovery Copies?",
  "author.recovery.forgetBody":
    "This deletes only the selected browser recovery copy. External Key Bundle JSON files and encrypted Unsigned Drafts are not deleted. Drafts using this Author Key will require importing its Key Bundle again.",
  "author.recovery.forgetAllBody":
    "This deletes only browser recovery copies. External Key Bundle JSON files and encrypted Unsigned Drafts are not deleted. Each Draft's Key Bundle must be imported again before it can be opened.",
  "author.recovery.forgot": "Browser Key Bundle Recovery Copy forgotten.",
  "author.recovery.forgotAll": "Browser Key Bundle Recovery Copies forgotten.",
  "author.recovery.forgetFailed":
    "Could not forget Browser Key Bundle Recovery Copies: {message}",
  "author.recovery.reminderTitle": "Save an external Key Bundle copy",
  "author.recovery.reminderBody":
    "This new Author Key has a browser recovery copy, but that is not a reliable backup. Download or copy its encrypted Key Bundle JSON before relying on this Author Key.",
  "author.recovery.created":
    "New Author Key created and Browser Key Bundle Recovery Copy cached.",
  "author.recovery.continue": "Continue to Unsigned Drafts",
  "author.recovery.missingDraft":
    "The requested Unsigned Draft is unavailable or invalid: {message}",
  "author.recovery.saveFailedTitle": "Draft save failed; Author Key remains unlocked",
  "author.recovery.saveFailedBody":
    "The attempted lock did not complete. Your Unsigned Draft changes remain available and have not been discarded.",
  "author.recovery.retrySaveLock": "Retry save and lock",
  "author.recovery.retrySaveLockFailed":
    "Could not save and lock the Unsigned Draft: {message}",
  "author.recovery.returnToDraft": "Return to Draft",
  "author.drafts.eyebrow": "Encrypted workspace",
  "author.drafts.title": "Unsigned Drafts",
  "author.drafts.intro":
    "Titles are decrypted only while this Author Key is unlocked.",
  "author.drafts.search": "Search Drafts",
  "author.drafts.searchPlaceholder": "Title or Draft ID",
  "author.drafts.sort": "Sort",
  "author.drafts.recent": "Recently updated",
  "author.drafts.byTitle": "Title",
  "author.drafts.empty": "No matching Drafts",
  "author.drafts.emptyBody":
    "Create a Protocol or import a Published Protocol to begin.",
  "author.workspace.eyebrow": "Unsigned Draft",
  "author.workspace.title": "Author Workspace",
  "author.workspace.outline": "Outline",
  "author.workspace.inspector": "Inspector",
  "author.workspace.protocolOutline": "Protocol outline",
  "author.workspace.sections": "Sections",
  "author.workspace.variables": "Variables",
  "author.workspace.tests": "Formula Test Cases",
  "author.workspace.summary": "Summary",
  "author.workspace.details": "Details",
  "author.workspace.formulaTests": "Formula tests",
  "author.workspace.addSection": "Add Section",
  "author.workspace.summaryTitle": "Protocol summary",
  "author.workspace.summaryBody":
    "Review the working structure of this Unsigned Draft before Preview or Publish.",
  "author.workspace.summarySections": "Sections",
  "author.workspace.summaryVariables": "Variables",
  "author.workspace.summaryTests": "Formula tests",
  "author.workspace.summaryInspector":
    "This overview reflects the current Unsigned Draft and is not a separate persisted field.",
  "author.section.taskItemCompletionRequirement":
    "Require all checklist items before completion",
  "author.section.taskItemsDetected": "{count} checklist items detected.",
  "author.section.taskItemsRequired":
    "Add at least one checklist item before enabling this requirement.",
  "author.section.timerVariable": "Timer Variable",
  "author.section.durationCandidate.numeric": "numeric",
  "author.section.durationCandidate.duration": "{unit} (duration)",
  "author.section.durationCandidate.derived": "derived",
  "author.formulaTest.title": "Title",
  "author.formulaTest.description": "Description",
  "author.formulaTest.descriptionPlaceholder":
    "Explain the scenario or boundary this test covers.",
  "author.variable.kind.duration": "Duration Input",
  "author.variable.kind.durationDerived": "Duration Derived",
  "author.variable.unit": "Unit",
  "author.variable.durationUnit.second": "Second (s)",
  "author.variable.durationUnit.minute": "Minute (min)",
  "author.variable.durationUnit.hour": "Hour (h)",
  "author.variable.durationUnit.day": "Day (d)",
  "author.variable.defaultValue": "Default",
  "author.variable.minimum": "Minimum",
  "author.variable.maximum": "Maximum",
  "author.variable.invalidDurationEntry":
    "Default, Minimum, and Maximum must be decimal numbers entered in the selected Duration Unit.",
  "author.publish.eyebrow": "Readiness → Output → Publish",
  "author.publish.title": "Publish Protocol",
  "author.publish.intro":
    "Review Playable checks before signing and saving immutable files.",
  "author.publish.preview": "Author Preview",
  "author.status.keyLocked": "Author Key locked",
  "author.status.keyUnlocked": "Author Key unlocked",
  "author.status.unsaved": "Unsaved changes",
  "author.status.saveFailed": "Save failed",
  "author.status.opening": "Opening Author Workspace…",
  "author.status.locked": "Author mode is locked",
  "author.status.unlocked": "Author mode unlocked",
  "author.status.keyCreated":
    "Key Bundle created. Save its JSON outside this application.",
  "author.status.draftCreated": "Unsigned Draft created",
  "author.status.draftRestored": "Unsigned Draft restored",
  "author.status.draftSaved": "Unsigned Draft saved",
  "author.status.modeLocked": "Author mode locked",
  "author.status.imageEmbedded": "Image embedded",
  "author.status.imported":
    "Published Protocol imported as an Unsigned Draft",
  "author.status.forked": "Published Protocol Forked as an Unsigned Draft",
  "author.status.published": "Published Protocol and checksum saved",
  "author.status.snapshotRestored": "Recovery snapshot restored",
  "author.status.closedUnsaved":
    "Unsigned Draft closed without saving changes",
  "author.fork.backToPublished": "Back to Published Protocol",
  "author.fork.accessTitle": "Create an editable Fork",
  "author.fork.accessBody":
    "Create or unlock an Author Key. Protocol Box will then create a new-identity Unsigned Draft from the original Published Protocol.",
  "author.fork.cancel": "Cancel and return to Published Protocol",
  "author.fork.badge": "Fork",
  "author.fork.from": "Forked from {fingerprint}",
  "author.fork.sourceDetails": "Source details",
  "author.fork.returnTitle": "Return to the Published Protocol?",
  "author.fork.returnBody":
    "Choose whether to save or discard the current Unsigned Draft changes before returning to the original signed Published Protocol.",
  "author.fork.saveReturn": "Save and return",
  "author.fork.discardReturn": "Discard and return",
} as const;
