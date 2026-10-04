export const help = {
  "help.title": "Protocol Box Help",
  "help.subtitle":
    "Offline guidance for authoring, checking, and following portable experimental procedures.",
  "help.backWorkbench": "Back to workbench",
  "help.backTopics": "Back to Help topics",
  "help.chooseTopic": "Choose a topic",
  "help.learn.authorKey": "Learn about Author Keys",
  "help.learn.drafts": "Learn about Drafts",
  "help.learn.sections": "Learn about Sections",
  "help.learn.variables": "Learn about Variables",
  "help.learn.formulas": "Formula Help",
  "help.learn.preview": "Learn about Preview",
  "help.learn.publish": "Publish Help",
  "help.topic.author": "Author Guide",
  "help.topic.author.summary":
    "Detailed guidance for the complete Author workflow.",
  "help.topic.reader": "Reader quick start",
  "help.topic.reader.summary":
    "Check a Published Protocol and follow its Sections.",
  "help.topic.glossary": "Glossary",
  "help.topic.glossary.summary":
    "Use Protocol Box domain terms consistently.",
  "help.topic.security": "Security and evidence",
  "help.topic.security.summary":
    "Understand signatures, local storage, and evidentiary limits.",
  "help.topic.keyboard": "Keyboard and pane controls",
  "help.topic.keyboard.summary":
    "Navigate the workbench efficiently without a pointer.",
  "help.topic.troubleshooting": "Troubleshooting",
  "help.topic.troubleshooting.summary":
    "Resolve blocked Playback, storage, and browser capability issues.",
  "help.author.intro":
    "An Author defines and signs the complete Protocol. Keep custody of the Author Key through its encrypted Key Bundle.",
  "help.author.step1.title": "Unlock Author mode",
  "help.author.step1.body":
    "Create a Key Bundle or open an existing encrypted Key Bundle with its password.",
  "help.author.step2.title": "Create or open an Unsigned Draft",
  "help.author.step2.body":
    "An Unsigned Draft stays encrypted in browser storage and remains editable until publication.",
  "help.author.step3.title": "Define the Protocol",
  "help.author.step3.body":
    "Add ordered Sections, Variable Definitions, formulas, and required Formula Test Cases.",
  "help.author.step4.title": "Save and preview",
  "help.author.step4.body":
    "Save the Unsigned Draft, then use Author Preview to check transient Variable Values and Playback behavior.",
  "help.author.step5.title": "Publish",
  "help.author.step5.body":
    "Resolve Playable Protocol checks, sign the Protocol, and save the self-contained HTML with its whole-file SHA-256.",
  "help.reader.intro":
    "A Reader configures and follows a Protocol without changing its signed definition.",
  "help.reader.step1.title": "Check the Signed Frame",
  "help.reader.step1.body":
    "Confirm Valid format, Signature Match, and Playable Protocol before starting.",
  "help.reader.step2.title": "Set Variable Values",
  "help.reader.step2.body":
    "Supply each Input Variable. Review Derived Variable results before Playback.",
  "help.reader.step3.title": "Choose Session storage",
  "help.reader.step3.body":
    "Use memory for sensitive Variable Values. Persistent Playback Sessions are plaintext convenience data.",
  "help.reader.step4.title": "Follow the current Section",
  "help.reader.step4.body":
    "Use the Section rail or drawer, respect timers, and confirm any Section change.",
  "help.reader.step5.title": "Use the Completion Summary carefully",
  "help.reader.step5.body":
    "The Completion Summary is unsigned, non-evidentiary, and intended only for printing or personal reference.",
  "help.glossary.intro":
    "These names are part of the file format and product contract.",
  "help.glossary.protocol.term": "Protocol",
  "help.glossary.protocol.definition":
    "A complete experimental procedure published by an Author for Readers to follow.",
  "help.glossary.author.term": "Author",
  "help.glossary.author.definition":
    "The person or organization that defines and signs a Protocol.",
  "help.glossary.reader.term": "Reader",
  "help.glossary.reader.definition":
    "A person who configures and follows a Protocol without changing its signed definition.",
  "help.glossary.authorKey.term": "Author Key",
  "help.glossary.authorKey.definition":
    "A signing key associated with an Author whose Author Key ID can be checked through a Trusted Distribution Channel.",
  "help.glossary.authorKeyId.term": "Author Key ID",
  "help.glossary.authorKeyId.definition":
    "A deterministic identifier of an Author Key's public key that people can compare through a Trusted Distribution Channel; it does not establish the Author's real-world identity.",
  "help.glossary.keyBundle.term": "Key Bundle",
  "help.glossary.keyBundle.definition":
    "An encrypted, portable file through which an Author retains custody of an Author Key.",
  "help.glossary.keyBundlePassword.term": "Key Bundle Password",
  "help.glossary.keyBundlePassword.definition":
    "A secret used only to encrypt and decrypt a Key Bundle; it is not an Author Key, account credential, identity proof, or recovery code.",
  "help.glossary.recoveryCopy.term": "Browser Key Bundle Recovery Copy",
  "help.glossary.recoveryCopy.definition":
    "An encrypted copy of a Key Bundle retained by one browser for local recovery or reopening; it does not replace a protected external Key Bundle copy.",
  "help.glossary.trustedChannel.term": "Trusted Distribution Channel",
  "help.glossary.trustedChannel.definition":
    "A channel independently chosen to obtain or compare an expected Author Key ID, Protocol Fingerprint, or whole-file SHA-256. Protocol Box does not determine whether that channel is trustworthy.",
  "help.glossary.section.term": "Section",
  "help.glossary.section.definition":
    "An ordered unit of a Protocol that the Reader follows as one Playback step.",
  "help.glossary.variableDefinition.term": "Variable Definition",
  "help.glossary.variableDefinition.definition":
    "An Author-declared, typed input accepted by a Protocol, including its default and constraints.",
  "help.glossary.inputVariable.term": "Input Variable",
  "help.glossary.inputVariable.definition":
    "A Variable Definition whose value is supplied by the Reader before a Playback Session begins.",
  "help.glossary.derivedVariable.term": "Derived Variable",
  "help.glossary.derivedVariable.definition":
    "A Variable Definition whose value is calculated from Input Variables or other Derived Variables by an Author-defined formula.",
  "help.glossary.durationVariable.term": "Duration Variable",
  "help.glossary.durationVariable.definition":
    "A Variable Definition whose value represents a time span, entered and presented in a Duration Unit and computed in canonical seconds.",
  "help.glossary.durationUnit.term": "Duration Unit",
  "help.glossary.durationUnit.definition":
    "A unit of time—second, minute, hour, or day—declared by the Author for entering and presenting a Duration Variable's value.",
  "help.glossary.variableValue.term": "Variable Value",
  "help.glossary.variableValue.definition":
    "A resolved value for an Input Variable or Derived Variable during a Playback Session.",
  "help.glossary.playbackSession.term": "Playback Session",
  "help.glossary.playbackSession.definition":
    "A browser-local, non-evidentiary record of one Reader's resumable progress through a Protocol, including Variable Values and timing state.",
  "help.glossary.completionSummary.term": "Completion Summary",
  "help.glossary.completionSummary.definition":
    "An unsigned, non-evidentiary view of a completed Playback Session for printing or personal reference.",
  "help.glossary.unsignedDraft.term": "Unsigned Draft",
  "help.glossary.unsignedDraft.definition":
    "An editable Protocol definition kept encrypted in browser storage that has not been signed in its current form.",
  "help.glossary.authorPreview.term": "Author Preview",
  "help.glossary.authorPreview.definition":
    "A non-evidentiary simulation in which an Author checks an Unsigned Draft using transient Variable Values and Playback behavior without creating a Playback Session or Completion Summary.",
  "help.glossary.formulaTest.term": "Formula Test Case",
  "help.glossary.formulaTest.definition":
    "An Author-defined set of Input Values and expected Derived Values used to detect changes in formula behavior.",
  "help.glossary.signatureMatch.term": "Signature Match",
  "help.glossary.signatureMatch.definition":
    "The Protocol's current content matches the signature of its embedded Author Key; this does not independently establish the Author's identity.",
  "help.glossary.signatureMismatch.term": "Signature Mismatch",
  "help.glossary.signatureMismatch.definition":
    "The Protocol's current content does not match its attached Author signature.",
  "help.glossary.playable.term": "Playable Protocol",
  "help.glossary.playable.definition":
    "A Protocol whose format, resource bounds, formulas, and content pass all checks required for Playback.",
  "help.glossary.fingerprint.term": "Protocol Fingerprint",
  "help.glossary.fingerprint.definition":
    "A short, human-comparable representation of the complete Protocol content used to distinguish one published version from another.",
  "help.glossary.published.term": "Published Protocol",
  "help.glossary.published.definition":
    "An immutable, signed Protocol HTML distributed by an Author with its whole-file SHA-256.",
  "help.glossary.fork.term": "Fork",
  "help.glossary.fork.definition":
    "A new Protocol derived from an existing Protocol but given a new Protocol identity.",
  "help.security.intro":
    "Protocol Box separates key custody, signed-content integrity, real-world identity, local storage, and evidence. Each boundary requires a different check.",
  "help.security.warning.title": "Know these limits before relying on a file",
  "help.security.warning.loss":
    "If every protected external Key Bundle copy is lost, or its Key Bundle Password is forgotten, Protocol Box cannot reconstruct the original Author Key.",
  "help.security.warning.identity":
    "Signature Match checks current content against the public key embedded in that file. It does not establish the Author's real-world identity.",
  "help.security.warning.evidence":
    "Persistent Playback Sessions are plaintext convenience data, and Completion Summaries are unsigned and non-evidentiary.",
  "help.security.custody.title": "Author custody",
  "help.security.custody.description":
    "Protect the portable Key Bundle, its password, and every unlocked browser session.",
  "help.security.custody.password":
    "Use a long, unique Key Bundle Password and preserve it separately. The creation form accepting a password does not mean that the password is strong.",
  "help.security.custody.recovery":
    "A browser may retain one validated Browser Key Bundle Recovery Copy per Author Key ID. It is browser-local convenience data that may disappear and never replaces a protected external Key Bundle copy.",
  "help.security.custody.lock":
    "Lock saves the current Draft and removes Protocol Box's references to the in-memory Author Key and Draft decryption material. It does not delete encrypted Drafts or recovery copies and does not promise secure erasure of browser process memory.",
  "help.security.custody.endpoint":
    "Encryption at rest does not protect an unlocked session from a controlled device, compromised browser, malicious extension, screen capture, or clipboard access.",
  "help.security.custody.revocation":
    "Protocol Box has no Author Key revocation list, certificate chain, account recovery, or automatic key rotation. A new Key Bundle creates a new Author Key ID; old Published Protocols still verify against their original embedded public key.",
  "help.security.custody.compromise":
    "If an Author Key may be exposed, stop using it, create a new Key Bundle, and announce the new Author Key ID through a Trusted Distribution Channel. Protocol Box cannot remotely revoke old files.",
  "help.security.verification.title": "Reader verification",
  "help.security.verification.description":
    "Decide which key and artifact you expected before trusting signed content.",
  "help.security.verification.signature":
    "Signature Match proves only that the current signed Protocol matches the Author Key embedded in the same Published Protocol.",
  "help.security.verification.replacement":
    "An attacker could replace the Protocol, embed a different public key, and sign the replacement. Signature Match alone would still succeed for that replacement key.",
  "help.security.verification.channel":
    "Compare the expected Author Key ID through a Trusted Distribution Channel independent of the Published Protocol. Protocol Box does not decide whether your chosen channel is trustworthy.",
  "help.security.localData.title": "Local data",
  "help.security.localData.description":
    "Choose storage according to the sensitivity and recovery value of the data.",
  "help.security.localData.drafts":
    "Unsigned Drafts and their recovery snapshots are encrypted in browser storage with keys derived while the matching Author Key is unlocked.",
  "help.security.localData.playback":
    "Persistent Playback Sessions store Variable Values and timing state as plaintext convenience data. Use memory-only Playback for sensitive Variable Values.",
  "help.security.localData.deletion":
    "Deleting a Draft or recovery copy, or clearing browser data, requests record deletion but does not promise forensic secure erasure from the underlying device.",
  "help.security.evidence.title": "Evidence and network boundaries",
  "help.security.evidence.description":
    "Offline operation and visible summaries do not turn local state into trusted evidence.",
  "help.security.evidence.summary":
    "A Completion Summary is unsigned and non-evidentiary. It is not an audit log, certificate, attestation, or proof that work occurred.",
  "help.security.evidence.network":
    "Application and Published Protocol files make no automatic runtime network requests. An Author-confirmed Download and Embed action explicitly fetches a remote image once.",
  "help.security.evidence.links":
    "Opening an external link requires Reader confirmation because it leaves the offline Published Protocol and may make network requests.",
  "help.security.identifiers.title": "Compare the right identifier",
  "help.security.identifiers.intro":
    "These identifiers answer different comparison questions. None independently proves a person's identity or that an experiment was performed.",
  "help.security.identifiers.name": "Identifier",
  "help.security.identifiers.identifies": "What it identifies",
  "help.security.identifiers.changes": "When it changes",
  "help.security.identifiers.limitation": "What it does not prove",
  "help.security.identifiers.authorKey.name": "Author Key ID",
  "help.security.identifiers.authorKey.identifies":
    "The public key associated with an Author Key.",
  "help.security.identifiers.authorKey.changes":
    "When a different Author Key is used.",
  "help.security.identifiers.authorKey.limitation":
    "It does not establish the Author's real-world identity or revoke another key.",
  "help.security.identifiers.protocol.name": "Protocol Fingerprint",
  "help.security.identifiers.protocol.identifies":
    "The complete canonical Protocol content.",
  "help.security.identifiers.protocol.changes":
    "When any canonical Protocol content changes.",
  "help.security.identifiers.protocol.limitation":
    "It does not identify the surrounding HTML bytes or prove who distributed them.",
  "help.security.identifiers.file.name": "Whole-file SHA-256",
  "help.security.identifiers.file.identifies":
    "The exact bytes of one distributed Published Protocol HTML file.",
  "help.security.identifiers.file.changes":
    "When any byte in the complete HTML file changes.",
  "help.security.identifiers.file.limitation":
    "It does not establish Author identity, content meaning, or completion.",
  "help.security.crypto.title": "Current cryptographic format details",
  "help.security.crypto.intro":
    "These details describe Key Bundle format version 1 and the current Unsigned Draft storage format. Future format versions may use different parameters.",
  "help.security.crypto.bundle":
    "A Key Bundle Password is processed with PBKDF2-HMAC-SHA-256 using a random salt and at least 600,000 iterations, calibrated upward for the device. The resulting key protects authenticated private-key ciphertext with AES-GCM.",
  "help.security.crypto.drafts":
    "While unlocked, Protocol Box derives a separate key for each Unsigned Draft with HKDF-SHA-256 and protects each Draft version with AES-GCM authenticated encryption.",
  "help.security.crypto.limit":
    "These mechanisms increase the cost of offline guessing and detect ciphertext modification. They cannot make a weak password strong or protect a compromised unlocked endpoint.",
  "help.security.related.title": "Related guidance",
  "help.security.related.authorKey": "Author Key and access",
  "help.security.related.drafts": "Unsigned Drafts",
  "help.security.related.publish": "Publish and recovery",
  "help.security.related.glossary": "Glossary",
  "help.security.related.security": "Security and evidence",
  "help.keyboard.intro":
    "Visible focus, predictable tab order, and explicit dialogs are part of the workbench contract.",
  "help.keyboard.general":
    "Use Tab and Shift+Tab to move through controls. Escape closes dismissible dialogs and restores focus to the opener.",
  "help.keyboard.help":
    "Press ? outside a text field to open keyboard help in Author mode.",
  "help.keyboard.save":
    "Press Ctrl+S or Command+S to save the current Unsigned Draft.",
  "help.keyboard.preview":
    "Press Ctrl+Shift+Enter or Command+Shift+Enter to open Author Preview.",
  "help.keyboard.panes":
    "Press B to toggle the Protocol outline and I to toggle the Inspector. Focus a pane separator and use arrow keys to resize it.",
  "help.keyboard.reader":
    "In Reader Playback, use the Section rail on wide screens or the Sections drawer on narrow screens. Every Section jump requires confirmation.",
  "help.keyboard.required":
    "Required acknowledgement dialogs cannot be dismissed with Escape.",
  "help.troubleshooting.intro":
    "Use the persistent status bar and Integrity details before retrying an action.",
  "help.troubleshooting.blocked":
    "If Playback is blocked, inspect format, signature, and Playable Protocol errors. Do not bypass a Signature Mismatch.",
  "help.troubleshooting.crypto":
    "If Web Crypto is unavailable, open the file in a current Chromium-based browser where local file cryptography is enabled.",
  "help.troubleshooting.storage":
    "If browser storage is unavailable, use a memory-only Playback Session. Progress will not survive closing the page.",
  "help.troubleshooting.timer":
    "If Playback pauses after the page was hidden or a timer delay was detected, review the reason and explicitly resume.",
  "help.troubleshooting.session":
    "If a stored Playback Session is quarantined, clear it and configure the current Published Protocol again.",
  "help.troubleshooting.author":
    "If Author mode is disabled, check IndexedDB, Web Crypto, and file-opening capability messages before opening a Draft.",} as const;
