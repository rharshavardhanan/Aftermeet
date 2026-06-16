// Default config for the extension. Runtime values are stored in
// chrome.storage.local and edited in the popup:
//   appOrigin — the Next.js web app (login + /extension/connect + workspace links)
//   apiBase   — the standalone NestJS backend the extension calls
//   token     — Bearer token pasted from the /extension/connect page
//   language  — last-selected spoken language for transcription
//
// content.js and popup.js read these directly from chrome.storage.local with the
// same defaults; this file documents the contract.
export const DEFAULTS = {
  appOrigin: "http://localhost:4000",
  apiBase: "http://localhost:4001",
  token: "",
  language: "",
};
