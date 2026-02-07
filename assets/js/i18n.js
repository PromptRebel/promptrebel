/* assets/js/i18n.js
   Static-site i18n (DE/EN) for PromptRebel
   - Switch via <select id="langSelect">
   - Persists in localStorage
   - Fallback: if a key is missing, existing HTML text remains
   - Supports:
     [data-i18n="key"]       -> textContent
     [data-i18n-html="key"]  -> innerHTML (trusted strings only)
     [data-i18n-attr="attr:key;attr2:key2"] -> set attributes
*/

(() => {
  "use strict";

  const STORAGE_KEY = "pr_lang";
  const DEFAULT_LANG = "de";
  const SUPPORTED = ["de", "en"];
  const ENABLE_QUERYSTRING_LANG = true; // ?lang=en optional

  // =========================
  // DICTIONARIES (FULL)
  // =========================
  // Notes:
  // - Strings used with data-i18n-html may contain <br/>, <b>, etc.
  // - Keep translations pragmatic and clear; you can refine wording later.
  const I18N = {
    de: {
      // ---- Global / UI ----
      "page.skip": "Zum Inhalt springen",
      "ui.language": "Sprache",

      // ---- Nav ----
      "nav.main": "Hauptnavigation",
      "nav.projects": "Projects",
      "nav.about": "About",
      "nav.lab": "Lab Notes",

      // ---- Breadcrumbs ----
      "crumb.home": "Home",
      "crumb.how": "So funktioniert’s",
      "crumb.prompts": "Prompts",

      // ---- HERO ----
      "how.category": "So funktioniert’s",
      "how.heroTitle": "Prompts verstehen",
      "how.heroMain":
        "🔥 Kein Zauber. Nur Struktur.<br/>Wir zerlegen einen Prompt in klare Bausteine – und zeigen, was passiert, wenn du genau <b>eine</b> Stelle änderst.",
      "how.heroSub":
        "Ziel: Du sollst Prompts nicht „glauben“, sondern <b>verstehen</b>.<br/>Du kannst danach denselben Aufbau auf eigene Ideen übertragen.",
      "how.quicknav": "Schnellnavigation",

      // Chips
      "chip.original": "Original",
      "chip.identity": "Identität",
      "chip.camera": "Kamera",
      "chip.pose": "Pose",
      "chip.background": "Hintergrund",
      "chip.light": "Licht",
      "chip.style": "Style",
      "chip.constraints": "Constraints",

      // TLDR / Key / Tip
      "tldr.title": "TL;DR",
      "tldr.text":
        "Prompts sind keine Magie. Sie sind Bausteine (Identität, Kamera, Licht …).<br/>Änderst du <b>einen</b> Baustein, ändert sich das Bild meist <b>vorhersehbar</b>.",
      "tldr.b1": "<b>1 Block ändern</b> → vergleichen",
      "tldr.b2": "Rest gleich lassen → Ursache klar",
      "tldr.b3": "Das Ziel ist Verständnis, nicht Perfektion",

      "key.title": "Wichtig",
      "key.text":
        "Diese Seite verkauft kein „perfektes Prompt“.<br/>Sie zeigt dir die <b>Hebel</b> – damit du deinen eigenen Weg findest.",

      "tip.oneword":
        "Tipp: Du brauchst nicht „kreativ“ zu sein. Ändere nur ein Wort – und beobachte den Effekt.",

      // ---- Panel header (optional, if you want to translate later) ----
      // (Terminal content can remain as-is, not everything needs keys.)

      // ---- ORIGINAL PROMPT SECTION ----
      "orig.title": "Beispielprompt: Skateboard",
      "orig.subtitle":
        "Das ist der Ausgangspunkt. Von hier aus ändern wir gezielt einzelne Bausteine.",
      "btn.copy": "Copy Prompt",
      "btn.copied": "Copied ✅",
      "orig.note":
        "Hinweis: Das Referenzfoto ist der „Identity Anchor“. Der Rest ist Szene/Styling.",

      "orig.img.original.caption": "Original Output (assets/…/original.PNG)",
      "orig.img.reference.caption": "Referenz Foto",
      "orig.img.original.alt": "Original Output (bitte Bilddatei ersetzen)",
      "orig.img.reference.alt": "Referenz Foto",

      // ---- Language & structure callout ----
      "langstruct.title": "Warum Englisch – und warum diese Struktur",
      "langstruct.lead":
        "Du musst Prompts nicht so schreiben wie ich. Das hier ist kein „richtig/falsch“ – sondern ein Weg, um Ergebnisse <b>reproduzierbarer</b> zu machen und Änderungen gezielt testen zu können.",
      "langstruct.card1.title": "1) Trainingsdaten-Realität",
      "langstruct.card1.p":
        "Viele Bild- und Sprachmodelle wurden stark mit englischen Texten trainiert. Deutsch funktioniert oft – aber Englisch ist meist <b>präziser</b>, <b>konsistenter</b> und leichter zu debuggen, wenn ein Prompt „driftet“.",
      "langstruct.card1.li1": "<b>Deutsch klappt auch</b> – vor allem bei klaren, einfachen Prompts.",
      "langstruct.card1.li2":
        "Wenn Pose/Objekte kippen, ist Englisch oft leichter nachzuschärfen.",
      "langstruct.card1.li3": "Es geht nicht um Sprache – sondern um <b>Klarheit</b>.",

      "langstruct.card2.title": "2) Struktur ist ein Werkzeug",
      "langstruct.card2.p":
        "Ich schreibe in Blöcken (Motiv, Kamera, Licht, Stil, Constraints), damit ich nichts vergesse und <b>gezielt</b> einzelne Hebel drehen kann.",
      "langstruct.card2.li1": "Du kannst denselben Inhalt auch als <b>Fließtext</b> schreiben.",
      "langstruct.card2.li2": "Wenn alle Infos drin sind, wird das Ergebnis oft ähnlich.",
      "langstruct.card2.li3": "Für Lernfortschritt: <b>immer nur 1 Block pro Test ändern</b>.",

      "langstruct.kicker":
        "<b>Merksatz:</b> Das ist ein Weg – nicht der Weg. Ziel ist Verständnis, nicht Copy/Paste.",
      "langstruct.details.summary": "Optional: Wenn du lieber frei schreibst …",
      "langstruct.details.p":
        "Dann denk trotzdem an die üblichen Stellschrauben: <b>Motiv</b>, <b>Kamera</b>, <b>Licht</b>, <b>Hintergrund</b>, <b>Stil</b>, <b>Constraints</b>. Wenn das enthalten ist, kommst du oft sehr weit – auch ohne Block-Struktur.",

      // ---- BLOCK 1: IDENTITY ----
      "b1.title": "Block 1: Identität (Referenzfoto)",
      "b1.subtitle":
        "Dieser Block sorgt dafür, dass es <b>dein</b> Tier bleibt – und nicht irgendein generischer Hund.",
      "b1.mb.title": "Identity Transfer",
      "b1.mb.sub": "Die wichtigste Regel: „Wie auf dem Referenzfoto“ – klar und wiederholt.",
      "b1.callout":
        "<b>Kurz gesagt:</b> Dieser Block entscheidet, ob es wirklich <b>dein</b> Hund bleibt (Fell, Muster, Proportionen) – oder ob das Modell zu „Random Dog“ driftet.",
      "b1.more.summary": "Mehr anzeigen",

      "b1.grid1.h": "Prompt-Ausschnitt",
      "b1.grid2.h": "Was macht das?",
      "b1.grid2.p":
        "Verankert Fellfarben, Muster, Proportionen und den „Look“ am Referenzfoto. Ohne diesen Block driftet das Ergebnis schnell zu „Random Dog“.",
      "b1.grid3.h": "Typische Anpassungen",
      "b1.grid3.li1": "„dog“ → „animal“ (für jedes Tier)",
      "b1.grid3.li2": "„captured mid-air“ → „standing / sitting“",
      "b1.grid3.li3": "mehr Details zu Fell/Markings (wenn nötig)",
      "b1.grid4.h": "Risiko",
      "b1.grid4.p":
        "Zu viel Zusatzbeschreibung kann das Referenzfoto „überschreiben“. Besser: kurz + eindeutig + wiederholbar.",

      "b1.img1.caption": "Original (Referenz stark)",
      "b1.img2.caption": "Variante: Identity zu schwach (identity_weak.PNG)",
      "b1.img1.alt": "Original (Identity Transfer aktiv)",
      "b1.img2.alt": "Variante: Identity schwach/unspezifisch",

      // ---- BLOCK 2: CAMERA ----
      "b2.title": "Block 2: Kamera / Lens",
      "b2.subtitle":
        "Kamera ist ein „Look-Schalter“. Fisheye wirkt krass – aber ist fehleranfälliger.",
      "b2.mb.title": "Fisheye vs. realistischer Look",
      "b2.mb.sub": "Ein einzelner Satz verändert die gesamte Bildphysik.",
      "b2.callout":
        "<b>Kurz gesagt:</b> Kamera-Wörter sind ein Look-Schalter. Fisheye = maximal dynamisch, aber anfälliger für anatomische Fehler.",
      "b2.more.summary": "Mehr anzeigen",
      "b2.grid1.h": "Prompt-Ausschnitt",
      "b2.grid2.h": "Was macht das?",
      "b2.grid2.p":
        "Fisheye verstärkt Dynamik durch Verzerrung: Vordergrund riesig, Background gebogen. Stark für Action – riskant für Anatomie.",
      "b2.grid3.h": "Typische Anpassungen",
      "b2.grid3.li1": "„fisheye“ → „35mm documentary photo“ (stabiler)",
      "b2.grid3.li2": "„extreme distortion“ → „no distortion“",
      "b2.grid3.li3": "Low-angle beibehalten, aber Verzerrung rausnehmen",
      "b2.grid4.h": "Risiko",
      "b2.grid4.p":
        "Extreme Linsen/Verzerrungen erhöhen die Fehlerquote (Pfoten, Board, Proportionen). Wenn es “driftet”: vereinfachen.",
      "b2.img1.caption": "Original: Fisheye",
      "b2.img2.caption": "Variante: 35mm (cam_35mm.PNG)",
      "b2.img1.alt": "Original: Fisheye",
      "b2.img2.alt": "Variante: 35mm, keine Verzerrung",

      // ---- BLOCK 3: POSE ----
      "b3.title": "Block 3: Pose & Action",
      "b3.subtitle":
        "Action entsteht durch klare Körperlogik: Was macht welche Pfote – und warum?",
      "b3.mb.title": "Paw / Trick / Board",
      "b3.mb.sub": "Je genauer die Pose, desto weniger Drift – aber: nicht überladen.",
      "b3.callout":
        "<b>Kurz gesagt:</b> Pose-Details steuern Körperlogik. Je klarer „wo sind die Pfoten“, desto stabiler wird das Ergebnis – aber nicht überladen.",
      "b3.more.summary": "Mehr anzeigen",
      "b3.grid1.h": "Prompt-Ausschnitt",
      "b3.grid2.h": "Was macht das?",
      "b3.grid2.p":
        "Erzwingt eine „Story Pose“ (High-five) + Stabilität (andere Pfoten am Board). Das gibt Bewegung und Fokus.",
      "b3.grid3.h": "Typische Anpassungen",
      "b3.grid3.li1": "High-five rausnehmen → stabilere Anatomie",
      "b3.grid3.li2": "„ALL FOUR paws … visible contact“ hinzufügen",
      "b3.grid3.li3": "Board-Logik konkretisieren (Kontaktflächen)",
      "b3.grid4.h": "Risiko",
      "b3.grid4.p":
        "Zu viele Pose-Details können miteinander konkurrieren. Besser: klare Priorität + wenige, testbare Sätze.",
      "b3.img1.caption": "Original: High-five paw",
      "b3.img2.caption": "Variante: natürliche Pose (pose_natural.PNG)",
      "b3.img1.alt": "Original: High-five paw",
      "b3.img2.alt": "Variante: natürliche Pose",

      // ---- BLOCK 4: BACKGROUND ----
      "b4.title": "Block 4: Hintergrund",
      "b4.subtitle":
        "Hintergrund ist nicht Deko – er steuert Kontext, Tempo und Lesbarkeit.",
      "b4.mb.title": "Urban Street vs. Skatepark",
      "b4.mb.sub":
        "Busy Background + Motion Blur kann „Action“ verstärken – oder das Motiv schlucken.",
      "b4.callout":
        "<b>Kurz gesagt:</b> Hintergrund steuert Kontext + Lesbarkeit. „Busy“ erhöht Action – aber auch Fehler (Text, Logos, Chaos).",
      "b4.more.summary": "Mehr anzeigen",
      "b4.grid1.h": "Prompt-Ausschnitt",
      "b4.grid2.h": "Was macht das?",
      "b4.grid2.p":
        "Urban + Motion Blur = Geschwindigkeit. Aber: zu viele Elemente erhöhen Fehlerquote (Texte, Schilder, Logos, Chaos).",
      "b4.grid3.h": "Typische Anpassungen",
      "b4.grid3.li1": "Hintergrund vereinfachen → Motiv bleibt klar",
      "b4.grid3.li2": "„no text, no logos“ hinzufügen",
      "b4.grid3.li3": "Motion Blur reduzieren",
      "b4.grid4.h": "Risiko",
      "b4.grid4.p":
        "Komplexe Hintergründe ziehen Aufmerksamkeit ab und erzeugen Nebenobjekte. Wenn dein Ziel Vergleichbarkeit ist: “clean” gewinnt.",
      "b4.img1.caption": "Original: Urban",
      "b4.img2.caption": "Variante: Skatepark (bg_skatepark.PNG)",
      "b4.img1.alt": "Original: Urban motion blur",
      "b4.img2.alt": "Variante: Skatepark clean",

      // ---- BLOCK 5: LIGHTING ----
      "b5.title": "Block 5: Licht",
      "b5.subtitle":
        "Licht ist „Emotion“. Es kann ein Bild retten oder komplett künstlich wirken lassen.",
      "b5.mb.title": "Epic Cinematic vs. Natural Daylight",
      "b5.mb.sub": "Wenn „epic“ zu viel ist: runterregeln, nicht löschen.",
      "b5.callout":
        "<b>Kurz gesagt:</b> Licht ist Stimmung. „Epic“ pusht Drama, „Natural“ pusht Glaubwürdigkeit.",
      "b5.more.summary": "Mehr anzeigen",
      "b5.grid1.h": "Prompt-Ausschnitt",
      "b5.grid2.h": "Was macht das?",
      "b5.grid2.p":
        "„Epic cinematic“ pusht Kontrast und Highlights. Gut für Drama. Kann aber schnell „KI-Poster“ schreien.",
      "b5.grid3.h": "Typische Anpassungen",
      "b5.grid3.li1": "„soft natural daylight“ für Foto-Realismus",
      "b5.grid3.li2": "Rim-Light reduzieren",
      "b5.grid3.li3": "Highlights “realistic” setzen",
      "b5.grid4.h": "Risiko",
      "b5.grid4.p":
        "Zu viel “epic” macht das Bild oft künstlich (übertriebene Kantenlichter, HDR-Look). Wenn es unnatürlich wirkt: “runterregeln”.",
      "b5.img1.caption": "Original: Epic",
      "b5.img2.caption": "Variante: Daylight (light_day.PNG)",
      "b5.img1.alt": "Original: Epic cinematic lighting",
      "b5.img2.alt": "Variante: Natural daylight",

      // ---- BLOCK 6: STYLE ----
      "b6.title": "Block 6: Stil / Textur",
      "b6.subtitle":
        "Style-Keywords beeinflussen „Materialität“: Körnung, Schärfe, Look.",
      "b6.mb.title": "Film Grain vs. Clean",
      "b6.mb.sub": "Körnung kann kaschieren – oder das Bild schmutzig machen.",
      "b6.callout":
        "<b>Kurz gesagt:</b> Style-Keywords ändern Textur/Materialität. Grain kann kaschieren – oder Details kaputt machen.",
      "b6.more.summary": "Mehr anzeigen",
      "b6.grid1.h": "Prompt-Ausschnitt",
      "b6.grid2.h": "Was macht das?",
      "b6.grid2.p":
        "„film grain/gritty“ fügt Dreck/Körnung/Analog-Look hinzu. Das kann „real“ wirken, aber auch Details fressen.",
      "b6.grid3.h": "Typische Anpassungen",
      "b6.grid3.li1": "„clean, crisp“ für mehr Detail",
      "b6.grid3.li2": "Grain komplett raus → Fellstruktur wird sichtbarer",
      "b6.grid3.li3": "“realistic photo look” als Anker",
      "b6.grid4.h": "Risiko",
      "b6.grid4.p":
        "Zu viele Stilwörter konkurrieren (gritty + glossy + dreamy + cinematic …). Ergebnis: Drift oder Chaos. Weniger ist oft stabiler.",
      "b6.img1.caption": "Original: Grain",
      "b6.img2.caption": "Variante: Clean (style_clean.PNG)",
      "b6.img1.alt": "Original: film grain gritty",
      "b6.img2.alt": "Variante: clean crisp",

      // ---- BLOCK 7: CONSTRAINTS ----
      "b7.title": "Block 7: Constraints",
      "b7.subtitle":
        "Constraints sind „Leitplanken“. Sie reduzieren Chaos – wenn sie konkret sind.",
      "b7.mb.title": "Constraints (Rules)",
      "b7.mb.sub": "Kurz, klar, testbar. Keine Romane.",
      "b7.callout":
        "<b>Kurz gesagt:</b> Constraints sind Leitplanken. Sie reduzieren Ausreißer – wenn sie kurz, klar und testbar sind.",
      "b7.more.summary": "Mehr anzeigen",
      "b7.grid1.h": "Prompt-Ausschnitt",
      "b7.grid2.h": "Was macht das?",
      "b7.grid2.p":
        "Verhindert typische Ausreißer: Collars, Harness, seltsame Proportionen, Zusatzobjekte. Stabilisiert das Ergebnis.",
      "b7.grid3.h": "Typische Anpassungen",
      "b7.grid3.li1": "Konkreter statt allgemein („correct paws count“)",
      "b7.grid3.li2": "Negativ klar benennen („no collar, no harness“)",
      "b7.grid3.li3": "Identity-Anchor wiederholen (Markings identical)",
      "b7.grid4.h": "Risiko",
      "b7.grid4.p":
        "Zu viele Constraints (lange Listen) können sich widersprechen oder die Priorität verwässern. Besser: kurz, hart, testbar.",
      "b7.img1.caption": "Original: Basic Constraints",
      "b7.img2.caption": "Variante: Strict (constraints_strict.PNG)",
      "b7.img1.alt": "Original: Constraints basic",
      "b7.img2.alt": "Variante: stricter constraints",

      // ---- Tool note / Soft vs Hard / Limits block (the big “implemented” block) ----
      "meta.title": "Hinweis zu Tools, Constraints & Grenzen der Methode",
      "meta.sub": "Die Logik bleibt gleich – die Stärke der Effekte kann variieren.",
      "meta.tools.title": "Hinweis zu Tools",
      "meta.tools.lead":
        "Die gezeigte Methode funktioniert modellübergreifend, aber nicht jedes Bild-Tool reagiert gleich stark auf dieselben Formulierungen. Manche Modelle gewichten Kamera, Stil oder Referenzbilder stärker als andere. <b>Die Logik bleibt identisch</b> – nur die Stärke der Effekte kann variieren.",

      "meta.softHard.card1.title": "Soft vs. Hard Constraints",
      "meta.softHard.card1.p":
        "Nicht alle Einschränkungen wirken gleich stark. Vage Formulierungen helfen – konkrete wirken zuverlässiger.",
      "meta.softHard.card2.title": "Wenn ein Modell Fehler macht …",
      "meta.softHard.card2.p":
        "… ersetze vage Begriffe durch konkrete Leitplanken. Das erhöht Kontrolle – besonders bei Anatomie, Symmetrie und Komposition.",

      "meta.soft.title": "Soft Constraints (weich)",
      "meta.hard.title": "Hard Constraints (konkret)",
      "meta.soft.li1": "natural",
      "meta.soft.li2": "realistic",
      "meta.soft.li3": "clean",
      "meta.soft.li4": "cinematic",
      "meta.hard.li1": "both eyes visible",
      "meta.hard.li2": "2 arms visible",
      "meta.hard.li3": "symmetrical face",
      "meta.hard.li4": "no extra fingers",
      "meta.hard.li5": "centered composition",

      "meta.limits.summary": "Wo diese Methode an Grenzen kommt",
      "meta.limits.intro":
        "Die „nur einen Block ändern“-Logik bringt Kontrolle – aber nicht in jeder Situation.",
      "meta.limits.1.title": "1) Gekoppelte Parameter",
      "meta.limits.1.p":
        "Kamera, Licht und Stil beeinflussen sich gegenseitig. Änderst du z. B. „dramatic lighting“, kann sich auch Pose oder Anatomie verändern. Dann ist die Änderung nicht mehr vollständig isoliert.",
      "meta.limits.2.title": "2) Stark stilisierte Modelle",
      "meta.limits.2.p":
        "Manche Modelle priorisieren Stil stärker als Struktur. Ein dominanter Stil kann Kamera oder Anatomie übersteuern.",
      "meta.limits.3.title": "3) Vage Prompts",
      "meta.limits.3.p":
        "Wenn der Basisprompt zu offen ist, reagiert das Modell stärker auf Zufall. Erst klare Struktur → dann isolierte Tests.",
      "meta.limits.4.title": "4) Kein Ersatz für Iteration",
      "meta.limits.4.p":
        "Auch saubere A/B-Tests garantieren kein perfektes Bild. Sie helfen zu verstehen, warum etwas funktioniert oder scheitert.<br><br>Diese Methode macht Ergebnisse kontrollierbarer – nicht perfekt.",

      // ---- “Was oft schiefgeht” block ----
      "fails.title": "Was oft schiefgeht (und warum)",
      "fails.sub": "Wenn du das erkennst, verschwindet 80% der Frustration.",
      "fails.bad1.title": "❌ Zu viel auf einmal",
      "fails.bad1.p":
        "Wenn du mehrere Blöcke gleichzeitig änderst, weißt du nicht, was den Effekt ausgelöst hat.",
      "fails.bad2.title": "❌ Fließtext-Overkill",
      "fails.bad2.p":
        "Sehr lange Prompts können Prioritäten verwässern. Oft ist „klar + kurz“ stabiler.",
      "fails.bad3.title": "❌ „Mehr Adjektive = besser“",
      "fails.bad3.p":
        "Zu viele Stilwörter konkurrieren miteinander. Ergebnis: Drift, Chaos, KI-Poster-Look.",
      "fails.good1.title": "✅ So debugst du richtig",
      "fails.good1.li1": "1 Block ändern",
      "fails.good1.li2": "3 Runs generieren",
      "fails.good1.li3": "Vergleichen → erst dann weiter",
      "fails.good2.title": "✅ Wenn’s „driftet“",
      "fails.good2.li1": "Identität verstärken (kurz + wiederholt)",
      "fails.good2.li2": "Kamera vereinfachen (kein Fisheye)",
      "fails.good2.li3": "Constraints konkretisieren",
      "fails.good3.title": "✅ Sprachen-Realität",
      "fails.good3.p":
        "Deutsch funktioniert oft. Wenn etwas unklar wird, ist Englisch leichter zu „debuggen“, weil viele Modelle darauf stärker trainiert sind.",
      "fails.good4.title": "✅ Reihenfolge",
      "fails.good4.p":
        "Erst Identität stabilisieren, dann Kamera/Pose, dann Licht/Style, dann Constraints feintunen.",
      "fails.good5.title": "✅ Test-Disziplin",
      "fails.good5.p":
        "Gleicher Seed/Settings helfen – aber wichtiger ist: immer nur einen Hebel verändern.",
      "fails.finalrule":
        "Minimal-Regel für Lernfortschritt: <b>Immer nur 1 Block ändern</b>, dann vergleichen.",

      // ---- Footer (optional) ----
      "footer.build": "current build:",
    },

    en: {
      // ---- Global / UI ----
      "page.skip": "Skip to content",
      "ui.language": "Language",

      // ---- Nav ----
      "nav.main": "Main navigation",
      "nav.projects": "Projects",
      "nav.about": "About",
      "nav.lab": "Lab Notes",

      // ---- Breadcrumbs ----
      "crumb.home": "Home",
      "crumb.how": "How it works",
      "crumb.prompts": "Prompts",

      // ---- HERO ----
      "how.category": "How it works",
      "how.heroTitle": "Understanding prompts",
      "how.heroMain":
        "🔥 No magic. Just structure.<br/>We break a prompt into clear building blocks — and show what happens when you change exactly <b>one</b> part.",
      "how.heroSub":
        "Goal: don’t “believe” prompts — <b>understand</b> them.<br/>Afterwards you can apply the same structure to your own ideas.",
      "how.quicknav": "Quick navigation",

      // Chips
      "chip.original": "Original",
      "chip.identity": "Identity",
      "chip.camera": "Camera",
      "chip.pose": "Pose",
      "chip.background": "Background",
      "chip.light": "Lighting",
      "chip.style": "Style",
      "chip.constraints": "Constraints",

      // TLDR / Key / Tip
      "tldr.title": "TL;DR",
      "tldr.text":
        "Prompts aren’t magic. They’re building blocks (identity, camera, lighting …).<br/>If you change <b>one</b> block, the image usually changes in a <b>predictable</b> way.",
      "tldr.b1": "<b>Change 1 block</b> → compare",
      "tldr.b2": "Keep the rest identical → clear causality",
      "tldr.b3": "The goal is understanding, not perfection",

      "key.title": "Important",
      "key.text":
        "This page doesn’t sell a “perfect prompt”.<br/>It shows you the <b>levers</b> — so you can find your own way.",

      "tip.oneword":
        "Tip: You don’t need to be “creative”. Change one word — and observe the effect.",

      // ---- ORIGINAL PROMPT SECTION ----
      "orig.title": "Example prompt: Skateboard",
      "orig.subtitle": "This is the baseline. From here we change individual blocks on purpose.",
      "btn.copy": "Copy Prompt",
      "btn.copied": "Copied ✅",
      "orig.note":
        "Note: The reference photo is the “identity anchor”. Everything else is scene/styling.",

      "orig.img.original.caption": "Original output (assets/…/original.PNG)",
      "orig.img.reference.caption": "Reference photo",
      "orig.img.original.alt": "Original output (please replace image file)",
      "orig.img.reference.alt": "Reference photo",

      // ---- Language & structure callout ----
      "langstruct.title": "Why English — and why this structure",
      "langstruct.lead":
        "You don’t have to write prompts like I do. This isn’t “right/wrong” — it’s a way to make results more <b>reproducible</b> and to test changes deliberately.",
      "langstruct.card1.title": "1) Training-data reality",
      "langstruct.card1.p":
        "Many image and language models were trained heavily on English text. German often works — but English is usually <b>more precise</b>, <b>more consistent</b>, and easier to debug when a prompt “drifts”.",
      "langstruct.card1.li1": "<b>German can work</b> — especially for clear, simple prompts.",
      "langstruct.card1.li2": "When pose/objects break, English is often easier to tighten up.",
      "langstruct.card1.li3": "It’s not about language — it’s about <b>clarity</b>.",

      "langstruct.card2.title": "2) Structure is a tool",
      "langstruct.card2.p":
        "I write in blocks (subject, camera, lighting, style, constraints) so I don’t forget anything and can turn individual levers <b>on purpose</b>.",
      "langstruct.card2.li1": "You can write the same content as <b>plain prose</b>.",
      "langstruct.card2.li2": "If the information is present, results are often similar.",
      "langstruct.card2.li3": "For learning: <b>change only 1 block per test</b>.",

      "langstruct.kicker":
        "<b>Rule of thumb:</b> This is one way — not the only way. The goal is understanding, not copy/paste.",
      "langstruct.details.summary": "Optional: If you prefer free-form writing …",
      "langstruct.details.p":
        "Still keep the usual knobs in mind: <b>subject</b>, <b>camera</b>, <b>lighting</b>, <b>background</b>, <b>style</b>, <b>constraints</b>. If those are included, you can get far — even without block structure.",

      // ---- BLOCK 1: IDENTITY ----
      "b1.title": "Block 1: Identity (reference photo)",
      "b1.subtitle":
        "This block keeps it <b>your</b> animal — instead of some generic dog.",
      "b1.mb.title": "Identity transfer",
      "b1.mb.sub": "Most important rule: “like the reference photo” — clear and repeated.",
      "b1.callout":
        "<b>In short:</b> This block decides whether it stays <b>your</b> dog (fur, markings, proportions) — or drifts into “random dog”.",
      "b1.more.summary": "Show more",

      "b1.grid1.h": "Prompt excerpt",
      "b1.grid2.h": "What it does",
      "b1.grid2.p":
        "Anchors fur colors, markings, proportions and the overall “look” to the reference photo. Without this block, results drift quickly into “random dog”.",
      "b1.grid3.h": "Common tweaks",
      "b1.grid3.li1": "“dog” → “animal” (works for any animal)",
      "b1.grid3.li2": "“captured mid-air” → “standing / sitting”",
      "b1.grid3.li3": "Add more fur/marking detail (if needed)",
      "b1.grid4.h": "Risk",
      "b1.grid4.p":
        "Too much extra description can overwrite the reference. Better: short + unambiguous + repeatable.",

      "b1.img1.caption": "Original (strong reference)",
      "b1.img2.caption": "Variant: identity too weak (identity_weak.PNG)",
      "b1.img1.alt": "Original (identity transfer active)",
      "b1.img2.alt": "Variant: identity weak/unspecific",

      // ---- BLOCK 2: CAMERA ----
      "b2.title": "Block 2: Camera / lens",
      "b2.subtitle":
        "Camera terms are a “look switch”. Fisheye looks wild — but is more error-prone.",
      "b2.mb.title": "Fisheye vs. realistic look",
      "b2.mb.sub": "One sentence can change the entire image physics.",
      "b2.callout":
        "<b>In short:</b> Camera words are a look switch. Fisheye = maximum dynamism, but higher risk of anatomy errors.",
      "b2.more.summary": "Show more",
      "b2.grid1.h": "Prompt excerpt",
      "b2.grid2.h": "What it does",
      "b2.grid2.p":
        "Fisheye boosts motion through distortion: huge foreground, curved background. Great for action — risky for anatomy.",
      "b2.grid3.h": "Common tweaks",
      "b2.grid3.li1": "“fisheye” → “35mm documentary photo” (more stable)",
      "b2.grid3.li2": "“extreme distortion” → “no distortion”",
      "b2.grid3.li3": "Keep low-angle but remove distortion",
      "b2.grid4.h": "Risk",
      "b2.grid4.p":
        "Extreme lenses/distortion raise the error rate (paws, board, proportions). If it drifts: simplify.",
      "b2.img1.caption": "Original: fisheye",
      "b2.img2.caption": "Variant: 35mm (cam_35mm.PNG)",
      "b2.img1.alt": "Original: fisheye",
      "b2.img2.alt": "Variant: 35mm, no distortion",

      // ---- BLOCK 3: POSE ----
      "b3.title": "Block 3: Pose & action",
      "b3.subtitle":
        "Action comes from clear body logic: which paw does what — and why?",
      "b3.mb.title": "Paw / trick / board",
      "b3.mb.sub": "The clearer the pose, the less drift — but don’t overload it.",
      "b3.callout":
        "<b>In short:</b> Pose details steer body logic. The clearer “where are the paws”, the more stable the result — but don’t overload it.",
      "b3.more.summary": "Show more",
      "b3.grid1.h": "Prompt excerpt",
      "b3.grid2.h": "What it does",
      "b3.grid2.p":
        "Forces a “story pose” (high-five) + stability (other paws on the board). That creates motion and focus.",
      "b3.grid3.h": "Common tweaks",
      "b3.grid3.li1": "Remove high-five → more stable anatomy",
      "b3.grid3.li2": "Add “ALL FOUR paws … visible contact”",
      "b3.grid3.li3": "Specify board contact logic",
      "b3.grid4.h": "Risk",
      "b3.grid4.p":
        "Too many pose details can compete. Better: clear priority + few testable sentences.",
      "b3.img1.caption": "Original: high-five paw",
      "b3.img2.caption": "Variant: natural pose (pose_natural.PNG)",
      "b3.img1.alt": "Original: high-five paw",
      "b3.img2.alt": "Variant: natural pose",

      // ---- BLOCK 4: BACKGROUND ----
      "b4.title": "Block 4: Background",
      "b4.subtitle":
        "Background isn’t decoration — it controls context, pace and readability.",
      "b4.mb.title": "Urban street vs. skatepark",
      "b4.mb.sub":
        "Busy backgrounds + motion blur can boost “action” — or swallow the subject.",
      "b4.callout":
        "<b>In short:</b> Background controls context + readability. “Busy” increases action — but also errors (text, logos, chaos).",
      "b4.more.summary": "Show more",
      "b4.grid1.h": "Prompt excerpt",
      "b4.grid2.h": "What it does",
      "b4.grid2.p":
        "Urban + motion blur = speed. But: too many elements increase the error rate (text, signs, logos, chaos).",
      "b4.grid3.h": "Common tweaks",
      "b4.grid3.li1": "Simplify background → keep subject readable",
      "b4.grid3.li2": "Add “no text, no logos”",
      "b4.grid3.li3": "Reduce motion blur",
      "b4.grid4.h": "Risk",
      "b4.grid4.p":
        "Complex backgrounds steal attention and generate extra objects. If you want comparability: “clean” wins.",
      "b4.img1.caption": "Original: urban",
      "b4.img2.caption": "Variant: skatepark (bg_skatepark.PNG)",
      "b4.img1.alt": "Original: urban motion blur",
      "b4.img2.alt": "Variant: skatepark clean",

      // ---- BLOCK 5: LIGHTING ----
      "b5.title": "Block 5: Lighting",
      "b5.subtitle":
        "Lighting is “emotion”. It can save an image — or make it look artificial.",
      "b5.mb.title": "Epic cinematic vs. natural daylight",
      "b5.mb.sub": "If “epic” is too much: dial it down, don’t delete it.",
      "b5.callout":
        "<b>In short:</b> Lighting is mood. “Epic” pushes drama, “natural” pushes believability.",
      "b5.more.summary": "Show more",
      "b5.grid1.h": "Prompt excerpt",
      "b5.grid2.h": "What it does",
      "b5.grid2.p":
        "“Epic cinematic” boosts contrast and highlights. Great for drama — but can quickly scream “AI poster”.",
      "b5.grid3.h": "Common tweaks",
      "b5.grid3.li1": "Use “soft natural daylight” for photo realism",
      "b5.grid3.li2": "Reduce rim light",
      "b5.grid3.li3": "Set highlights to “realistic”",
      "b5.grid4.h": "Risk",
      "b5.grid4.p":
        "Too much “epic” often looks artificial (overdone edge light, HDR vibe). If it feels unnatural: dial it down.",
      "b5.img1.caption": "Original: epic",
      "b5.img2.caption": "Variant: daylight (light_day.PNG)",
      "b5.img1.alt": "Original: epic cinematic lighting",
      "b5.img2.alt": "Variant: natural daylight",

      // ---- BLOCK 6: STYLE ----
      "b6.title": "Block 6: Style / texture",
      "b6.subtitle": "Style keywords control “materiality”: grain, sharpness, look.",
      "b6.mb.title": "Film grain vs. clean",
      "b6.mb.sub": "Grain can hide problems — or make the image dirty.",
      "b6.callout":
        "<b>In short:</b> Style keywords change texture/materiality. Grain can hide issues — or destroy detail.",
      "b6.more.summary": "Show more",
      "b6.grid1.h": "Prompt excerpt",
      "b6.grid2.h": "What it does",
      "b6.grid2.p":
        "“film grain/gritty” adds dirt/grain/analog vibe. It can feel “real” — but can also eat detail.",
      "b6.grid3.h": "Common tweaks",
      "b6.grid3.li1": "Use “clean, crisp” for more detail",
      "b6.grid3.li2": "Remove grain → fur texture becomes clearer",
      "b6.grid3.li3": "Use “realistic photo look” as an anchor",
      "b6.grid4.h": "Risk",
      "b6.grid4.p":
        "Too many style words compete (gritty + glossy + dreamy + cinematic …). Result: drift or chaos. Less is often more stable.",
      "b6.img1.caption": "Original: grain",
      "b6.img2.caption": "Variant: clean (style_clean.PNG)",
      "b6.img1.alt": "Original: film grain gritty",
      "b6.img2.alt": "Variant: clean crisp",

      // ---- BLOCK 7: CONSTRAINTS ----
      "b7.title": "Block 7: Constraints",
      "b7.subtitle":
        "Constraints are guardrails. They reduce chaos — if they’re concrete.",
      "b7.mb.title": "Constraints (rules)",
      "b7.mb.sub": "Short, clear, testable. No novels.",
      "b7.callout":
        "<b>In short:</b> Constraints are guardrails. They reduce outliers — if they’re short, clear, and testable.",
      "b7.more.summary": "Show more",
      "b7.grid1.h": "Prompt excerpt",
      "b7.grid2.h": "What it does",
      "b7.grid2.p":
        "Prevents typical outliers: collars, harnesses, weird proportions, extra objects. Stabilizes the result.",
      "b7.grid3.h": "Common tweaks",
      "b7.grid3.li1": "Be more concrete than general (“correct paws count”)",
      "b7.grid3.li2": "Name negatives explicitly (“no collar, no harness”)",
      "b7.grid3.li3": "Repeat the identity anchor (markings identical)",
      "b7.grid4.h": "Risk",
      "b7.grid4.p":
        "Too many constraints (long lists) can contradict each other or blur priority. Better: short, hard, testable.",
      "b7.img1.caption": "Original: basic constraints",
      "b7.img2.caption": "Variant: strict (constraints_strict.PNG)",
      "b7.img1.alt": "Original: constraints basic",
      "b7.img2.alt": "Variant: stricter constraints",

      // ---- Tool note / Soft vs Hard / Limits ----
      "meta.title": "Tool note, constraints & method limits",
      "meta.sub": "The logic stays the same — only the strength of effects can vary.",
      "meta.tools.title": "Tool note",
      "meta.tools.lead":
        "The method works across models, but different image tools respond with different strength to the same phrasing. Some models weigh camera, style or reference images more heavily than others. <b>The logic remains identical</b> — only the intensity of effects varies.",

      "meta.softHard.card1.title": "Soft vs. hard constraints",
      "meta.softHard.card1.p":
        "Not all constraints have the same strength. Vague phrasing can help — concrete rules are more reliable.",
      "meta.softHard.card2.title": "When a model makes mistakes …",
      "meta.softHard.card2.p":
        "… replace vague words with concrete guardrails. That increases control — especially for anatomy, symmetry and composition.",

      "meta.soft.title": "Soft constraints",
      "meta.hard.title": "Hard constraints",
      "meta.soft.li1": "natural",
      "meta.soft.li2": "realistic",
      "meta.soft.li3": "clean",
      "meta.soft.li4": "cinematic",
      "meta.hard.li1": "both eyes visible",
      "meta.hard.li2": "2 arms visible",
      "meta.hard.li3": "symmetrical face",
      "meta.hard.li4": "no extra fingers",
      "meta.hard.li5": "centered composition",

      "meta.limits.summary": "Where this method hits limits",
      "meta.limits.intro":
        "The “change only one block” logic adds control — but not in every situation.",
      "meta.limits.1.title": "1) Coupled parameters",
      "meta.limits.1.p":
        "Camera, lighting and style influence each other. If you change “dramatic lighting”, pose or anatomy can shift too. Then the change isn’t perfectly isolated anymore.",
      "meta.limits.2.title": "2) Strongly stylized models",
      "meta.limits.2.p":
        "Some models prioritize style over structure. A dominant style can override camera or anatomy.",
      "meta.limits.3.title": "3) Vague base prompts",
      "meta.limits.3.p":
        "If the base prompt is too open, randomness has more room. First: clear structure → then isolated tests.",
      "meta.limits.4.title": "4) Not a replacement for iteration",
      "meta.limits.4.p":
        "Even clean A/B tests don’t guarantee a perfect image. They help you understand why something works or fails.<br><br>This method makes results more controllable — not perfect.",

      // ---- “What often goes wrong” ----
      "fails.title": "What often goes wrong (and why)",
      "fails.sub": "If you recognize this, 80% of frustration disappears.",
      "fails.bad1.title": "❌ Too much at once",
      "fails.bad1.p":
        "If you change multiple blocks at the same time, you can’t know what caused the effect.",
      "fails.bad2.title": "❌ Prose overload",
      "fails.bad2.p":
        "Very long prompts can dilute priorities. Often “clear + short” is more stable.",
      "fails.bad3.title": "❌ “More adjectives = better”",
      "fails.bad3.p":
        "Too many style words compete. Result: drift, chaos, AI-poster look.",
      "fails.good1.title": "✅ How to debug correctly",
      "fails.good1.li1": "Change 1 block",
      "fails.good1.li2": "Generate 3 runs",
      "fails.good1.li3": "Compare → only then continue",
      "fails.good2.title": "✅ If it drifts",
      "fails.good2.li1": "Strengthen identity (short + repeated)",
      "fails.good2.li2": "Simplify camera (no fisheye)",
      "fails.good2.li3": "Make constraints more concrete",
      "fails.good3.title": "✅ Language reality",
      "fails.good3.p":
        "German often works. If things get fuzzy, English is easier to debug because many models were trained more strongly on it.",
      "fails.good4.title": "✅ Order",
      "fails.good4.p":
        "Stabilize identity first, then camera/pose, then lighting/style, then fine-tune constraints.",
      "fails.good5.title": "✅ Test discipline",
      "fails.good5.p":
        "Same seed/settings can help — but more important is changing only one lever at a time.",
      "fails.finalrule":
        "Minimal rule for learning: <b>Change only 1 block</b>, then compare.",

      // ---- Footer (optional) ----
      "footer.build": "current build:",
    },
  };

  // =========================
  // Helpers
  // =========================
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function normalizeLang(lang) {
    if (!lang) return DEFAULT_LANG;
    const l = String(lang).toLowerCase();
    const base = l.split("-")[0];
    return SUPPORTED.includes(base) ? base : DEFAULT_LANG;
  }

  function getQueryLang() {
    if (!ENABLE_QUERYSTRING_LANG) return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("lang");
  }

  function detectInitialLang() {
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
    });

    // data-i18n-html -> innerHTML (trusted strings only)
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

    window.dispatchEvent(
      new CustomEvent("i18n:changed", { detail: { lang: normalized } })
    );
  }

  function wireSelect() {
    const sel = document.getElementById("langSelect");
    if (!sel) return;
    sel.addEventListener("change", (e) => applyLang(e.target.value));
  }

  // =========================
  // Init
  // =========================
  document.addEventListener("DOMContentLoaded", () => {
    const initial = detectInitialLang();
    wireSelect();
    applyLang(initial);
  });

  // Optional API
  window.PromptRebelI18n = {
    applyLang,
    getLang: () =>
      normalizeLang(localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG),
    dict: (lang) => getDict(normalizeLang(lang || DEFAULT_LANG)),
  };
})();
