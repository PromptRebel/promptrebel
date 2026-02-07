/* assets/js/i18n.js
   Minimal, robust i18n for static sites (GitHub Pages friendly)
   - DE/EN switch
   - localStorage persistence
   - browser language fallback
   - supports:
     [data-i18n="key"]        -> textContent
     [data-i18n-html="key"]   -> innerHTML (only for trusted strings you control)
     [data-i18n-attr="attr:key;attr2:key2"] -> set attributes (placeholder/title/alt/aria-label/...)
*/

(() => {
  "use strict";

  // -------- CONFIG --------
  const STORAGE_KEY = "pr_lang";
  const DEFAULT_LANG = "de";
  const SUPPORTED = ["de", "en"];

  // Optional: set to true if you want URL override like ?lang=en
  const ENABLE_QUERYSTRING_LANG = true;

  // -------- DICTIONARIES --------
  // Keep it lean: start with keys for "So funktioniert's" only.
  // Add more keys later, page by page.
  const I18N = {
    de: {
      // Example common UI keys
      "ui.language": "Sprache",
      "ui.de": "Deutsch",
      "ui.en": "Englisch",

      // --- So funktioniert's (examples; replace/add your real text keys) ---
      "how.title": "So funktioniert’s",
      "how.subtitle": "Prompt-Autopsie: Ursache → Wirkung durch isolierte Änderungen",
      "how.note.tools.title": "Hinweis zu Tools",
      "how.note.tools.text":
        "Die Methode funktioniert modellübergreifend, aber nicht jedes Bild-Tool reagiert gleich stark auf dieselben Formulierungen. Die Logik bleibt identisch – nur die Stärke der Effekte kann variieren.",

      "how.constraints.title": "Soft vs. Hard Constraints",
      "how.constraints.soft": "Soft Constraints (weich)",
      "how.constraints.hard": "Hard Constraints (konkret)",

      "how.limits.title": "Wo die Methode an Grenzen kommt",
      "how.limits.p1": "Kamera, Licht und Stil beeinflussen sich gegenseitig – nicht jede Änderung bleibt vollständig isoliert.",
    },

    en: {
      // Example common UI keys
      "ui.language": "Language",
      "ui.de": "German",
      "ui.en": "English",

      // --- How it works (examples; translate properly) ---
      "how.title": "How it works",
      "how.subtitle": "Prompt autopsy: cause → effect via isolated changes",
      "how.note.tools.title": "Tool note",
      "how.note.tools.text":
        "The method works across models, but different image tools respond with different strength to the same phrasing. The logic stays the same — only the intensity of effects varies.",

      "how.constraints.title": "Soft vs. hard constraints",
      "how.constraints.soft": "Soft constraints",
      "how.constraints.hard": "Hard constraints",

      "how.limits.title": "Where this method hits limits",
      "how.limits.p1": "Camera, lighting, and style influence each other — not every change stays perfectly isolated.",
    },
  };

  // -------- HELPERS --------
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function normalizeLang(lang) {
    if (!lang) return DEFAULT_LANG;
    const l = String(lang).toLowerCase();

    // Handle values like "en-US"
    const base = l.split("-")[0];
    return SUPPORTED.includes(base) ? base : DEFAULT_LANG;
  }

  function getQueryLang() {
    if (!ENABLE_QUERYSTRING_LANG) return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("lang");
  }

  function detectInitialLang() {
    // Priority:
    // 1) querystring ?lang=en (optional)
    // 2) saved localStorage
    // 3) browser language
    // 4) default
    const q = getQueryLang();
    if (q) return normalizeLang(q);

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeLang(saved);

    const browser = navigator.language || navigator.userLanguage;
    return normalizeLang(browser);
  }

  function getDict(lang) {
    return I18N[lang] || I18N[DEFAULT_LANG];
  }

  function setLangOnHtmlTag(lang) {
    document.documentElement.lang = lang;
  }

  function applyTextNodes(lang) {
    const dict = getDict(lang);

    // data-i18n -> textContent
    $all("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const val = dict[key];
      if (val != null) el.textContent = val;
      // If missing: keep existing text as fallback (important!)
    });

    // data-i18n-html -> innerHTML (only trusted strings!)
    $all("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      const val = dict[key];
      if (val != null) el.innerHTML = val;
    });
  }

  function applyAttributes(lang) {
    const dict = getDict(lang);

    // data-i18n-attr="placeholder:key;title:key2;alt:key3"
    $all("[data-i18n-attr]").forEach((el) => {
      const spec = el.getAttribute("data-i18n-attr");
      if (!spec) return;

      // Split by ; into attr:key pairs
      const pairs = spec.split(";").map((s) => s.trim()).filter(Boolean);
      pairs.forEach((pair) => {
        const idx = pair.indexOf(":");
        if (idx === -1) return;

        const attr = pair.slice(0, idx).trim();
        const key = pair.slice(idx + 1).trim();
        if (!attr || !key) return;

        const val = dict[key];
        if (val != null) el.setAttribute(attr, val);
      });
    });
  }

  function syncSelect(lang) {
    const sel = document.getElementById("langSelect");
    if (!sel) return;
    sel.value = lang;
  }

  function applyLang(lang) {
    const normalized = normalizeLang(lang);
    setLangOnHtmlTag(normalized);

    applyTextNodes(normalized);
    applyAttributes(normalized);

    localStorage.setItem(STORAGE_KEY, normalized);
    syncSelect(normalized);

    // Optional hook: allow page scripts to react
    window.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang: normalized } }));
  }

  function wireSelect() {
    const sel = document.getElementById("langSelect");
    if (!sel) return;

    sel.addEventListener("change", (e) => {
      applyLang(e.target.value);
    });
  }

  // -------- INIT --------
  document.addEventListener("DOMContentLoaded", () => {
    const initial = detectInitialLang();
    wireSelect();
    applyLang(initial);
  });

  // Expose minimal API (optional)
  window.PromptRebelI18n = {
    applyLang,
    getLang: () => normalizeLang(localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG),
  };
})();
