export const reader = {
  "reader.heading": "Protocol Box Reader",
  "reader.subtitle": "Focused scientific publishing workbench",
  "reader.progress": "Reader progress",
  "reader.stage.configure": "Configure",
  "reader.stage.playback": "Playback",
  "reader.stage.completion": "Completion",
  "reader.frame.signed": "Signed Frame",
  "reader.frame.preview": "Author Preview Frame",
  "reader.frame.published": "Published Protocol",
  "reader.frame.previewBadge": "Author Preview",
  "reader.frame.unsignedDraft": "Unsigned Draft",
  "reader.frame.validFormat": "Valid format",
  "reader.frame.invalidFormat": "Invalid format",
  "reader.frame.signatureMatch": "Signature Match",
  "reader.frame.signatureMismatch": "Signature Mismatch",
  "reader.frame.signatureUnverified": "Signature unverified",
  "reader.frame.playable": "Playable Protocol",
  "reader.frame.notPlayable": "Not Playable",
  "reader.frame.integrityDetails": "Integrity details",
  "reader.frame.identityCaveat":
    "Signature Match checks signed-content integrity; it does not establish the Author's real-world identity.",
  "reader.integrity.title": "Integrity details",
  "reader.integrity.close": "Close details",
  "reader.integrity.overview":
    "These checks describe this embedded Protocol and whether Playback can start.",
  "reader.integrity.format": "Format",
  "reader.integrity.signature": "Signature",
  "reader.integrity.playability": "Playback readiness",
  "reader.integrity.fingerprint": "Protocol Fingerprint",
  "reader.integrity.authorKeyId": "Author Key ID",
  "reader.integrity.checks": "Check details",
  "reader.integrity.noErrors": "No integrity or playability errors were reported.",
  "reader.blocked.invalid":
    "Playback is blocked because the Published Protocol format is invalid. Review the check details and obtain a new file from the Author.",
  "reader.blocked.mismatch":
    "Playback is blocked because the Protocol content no longer matches its attached Author signature.",
  "reader.blocked.unverified":
    "Playback is blocked because Signature Match could not be checked in this browser.",
  "reader.blocked.notPlayable":
    "Playback is blocked because one or more Playable Protocol checks failed.",
  "reader.preview.notice":
    "Author Preview is unsigned and non-evidentiary. It creates no Playback Session or Completion Summary.",
  "reader.preview.inMemory": "In-memory",
  "reader.configuration.title": "Variable Values",
  "reader.configuration.intro":
    "Set each Input Variable before starting the Playback Session. Derived Variables update automatically.",
  "reader.configuration.inputVariables": "Input Variables",
  "reader.configuration.derivedVariables": "Derived Variables",
  "reader.configuration.noInputs":
    "This Protocol has no Input Variables to set.",
  "reader.configuration.noDerived":
    "This Protocol has no Derived Variables.",
  "reader.configuration.minimum": "Minimum: {value}",
  "reader.configuration.maximum": "Maximum: {value}",
  "reader.configuration.errors": "Variable Value checks",
  "reader.storage.legend": "Playback Session storage",
  "reader.storage.warning":
    "Persistent Playback Sessions are stored as plaintext in this browser and are unsuitable for sensitive Variable Values.",
  "reader.storage.memory": "Memory only",
  "reader.storage.persistent": "Persistent on this browser",
  "reader.storage.selected": "Selected",
  "reader.storage.confirm":
    "I understand that persistent Playback Session Variable Values are stored as plaintext.",
  "reader.storage.unavailable":
    "Browser storage is unavailable. This Playback Session will remain in memory.",
  "reader.storage.preview":
    "Author Preview is always memory-only and does not create a Playback Session.",
  "reader.action.start": "Start Playback",
  "reader.action.completeSection": "Complete Section",
  "reader.action.resume": "Resume Playback",
  "reader.action.timerRunning": "Timer running",
  "reader.action.completeChecklist": "Complete checklist items",
  "reader.action.clearSession": "Clear Playback Session",
  "reader.action.resetPreview": "Reset Author Preview",
  "reader.action.exitPreview": "Exit Preview",
  "reader.action.print": "Print or Export",
  "reader.fork.create": "Create editable Fork",
  "reader.fork.return": "Return to editable Fork",
  "reader.fork.createAnother": "Create another Fork",
  "reader.fork.more": "More Author options",
  "reader.fork.options": "Author options",
  "reader.fork.blockedFormat":
    "Forking requires a valid Published Protocol format.",
  "reader.fork.blockedSignature":
    "Forking requires Signature Match. Inspect the file before using its content.",
  "reader.fork.dialogTitle": "Create an editable Fork?",
  "reader.fork.dialogBody":
    "The signed Published Protocol will not change. Protocol Box will create an Unsigned Draft with a new Protocol identity and preserve the source fingerprint.",
  "reader.fork.confirm": "Continue to Author Access",
  "reader.fork.memorySession":
    "This Memory-only Playback Session will be discarded when you leave Reader.",
  "reader.fork.persistentSession":
    "The Persistent Playback Session remains stored in this browser and can be restored when Reader opens again.",
  "reader.playback.sections": "Protocol Sections",
  "reader.playback.sectionDrawer": "Sections ({current} of {total})",
  "reader.playback.jumpTo": "Jump to {title}",
  "reader.playback.current": "Current",
  "reader.playback.complete": "Complete",
  "reader.playback.pending": "Pending",
  "reader.playback.currentSection": "Current Section",
  "reader.playback.untimed": "Untimed",
  "reader.playback.fixedTimer": "{duration} timer",
  "reader.playback.derivedTimer": "Variable timer",
  "reader.playback.timer": "Section timer",
  "reader.playback.remaining": "{duration} remaining",
  "reader.playback.taskItemsComplete":
    "{checked} of {total} checklist items complete.",
  "reader.playback.taskItemsReadOnly":
    "This completed Section's checklist is read-only.",
  "reader.playback.sectionCompleted": "Section complete",
  "reader.playback.paused": "Playback paused: {reason}",
  "reader.playback.pause.clock-drift":
    "the browser clocks diverged; confirm before continuing",
  "reader.playback.pause.timer-delay":
    "the timer callback was delayed; confirm before continuing",
  "reader.playback.pause.page-hidden":
    "the page was hidden; confirm before continuing",
  "reader.playback.pause.page-visible":
    "the page became visible; confirm before continuing",
  "reader.playback.sessionActions": "Session actions",
  "reader.wait.title": "Section timer complete",
  "reader.wait.confirm": "Acknowledge Section",
  "reader.wait.body":
    "Acknowledge this Section before Playback continues.",
  "reader.jump.title": "Change Section?",
  "reader.jump.confirm": "Change Section",
  "reader.jump.body": "Skipped Sections will not be marked complete.",
  "reader.external.title": "Open external link?",
  "reader.external.confirm": "Open link",
  "reader.external.body":
    "The following address will leave this offline Published Protocol:",
  "reader.clear.title": "Clear Playback Session?",
  "reader.clear.confirm": "Clear Session",
  "reader.clear.body":
    "This removes progress stored for the current Protocol Fingerprint.",
  "reader.previewReset.title": "Reset Author Preview?",
  "reader.previewReset.confirm": "Reset Preview",
  "reader.previewReset.body":
    "This clears transient Variable Values and Preview progress.",
  "reader.quarantine.title": "Playback Session quarantined",
  "reader.quarantine.body":
    "Stored progress did not match this Protocol and was moved aside. Clear it before starting again.",
  "reader.completion.title": "Completion Summary",
  "reader.completion.nonAudit": "Non-audit personal reference",
  "reader.completion.warning":
    "Unsigned · non-evidentiary. This Completion Summary is for printing or personal reference only.",
  "reader.completion.fingerprint": "Protocol Fingerprint",
  "reader.completion.started": "Started (UTC)",
  "reader.completion.completed": "Completed (UTC)",
  "reader.completion.values": "Variable Values",
  "reader.completion.sections": "Completed Sections",
  "reader.completion.noValues": "No Variable Values were recorded.",
  "reader.completion.previewTitle": "Simulation finished",
  "reader.completion.previewBody":
    "The Author Preview finished. No Playback Session or Completion Summary was created.",
  "reader.status.opening": "Opening Published Protocol…",
  "reader.status.openingPreview": "Opening Author Preview…",
  "reader.status.ready": "Published Protocol ready",
  "reader.status.previewReady": "Author Preview ready",
  "reader.status.restored":
    "Persistent Playback Session restored and paused",
  "reader.status.quarantined": "Invalid Playback Session quarantined",
  "reader.status.blocked": "Playback blocked; open Integrity details",
  "reader.status.inputFailed": "Input Variable update failed",
  "reader.status.playbackFailed": "Playback could not start",
  "reader.status.playbackStarted": "Playback started",
  "reader.status.advanced": "Advanced to {title}",
  "reader.status.timerComplete":
    "Section timer complete; acknowledgement required",
  "reader.status.paused": "Playback paused; confirmation required",
  "reader.status.sectionComplete": "Section complete",
  "reader.status.resumed": "Playback resumed",
  "reader.status.sectionChanged": "Current Section changed to {title}",
  "reader.status.sessionCleared": "Playback Session cleared",
  "reader.status.previewReset": "Author Preview reset",
  "reader.status.actionFailed": "The requested Reader action failed",
  "reader.status.offline": "Offline document",
  "reader.status.memory": "Memory-only Session",
  "reader.status.persistent": "Persistent local Session",
  "reader.status.preview": "Non-evidentiary Preview",
  "reader.error.missingInput": "Set a Variable Value for {variable}.",
  "reader.error.invalidInput":
    "The Variable Value for {variable} does not meet its declared type or constraints.",
  "reader.error.invalidDuration":
    "A resolved Section duration must be from 1 second through 7 days.",
  "reader.error.webCrypto":
    "Web Crypto is unavailable; Signature Match cannot be checked.",
  "reader.error.invalidSession":
    "The stored Playback Session contains invalid or impossible progress.",
  "reader.error.resourceLimit":
    "A Protocol resource limit was exceeded at {path}.",
  "reader.error.invalidImage":
    "An embedded image is invalid at {path}.",
  "reader.error.formula":
    "A Derived Variable formula check failed at {path}.",
  "reader.error.structure": "The Protocol structure is invalid at {path}.",
  "reader.error.generic": "Check failed at {path} ({code}).",
} as const;
