export interface LiveTestHit {
  vendor: string;
}

export interface LiveTestInspectResult {
  vendor: string | null;
  hidden: number;
}

export interface LiveTestSignals {
  scriptSrcs: string[];
  iframeSrcs: string[];
  classIds: string;
  scriptBodies: string;
}

const VENDORS: {
  vendor: string;
  script: RegExp;
  global: RegExp;
  classId: RegExp;
}[] = [
  {
    vendor: "Spiralyze",
    script: /spiralyze/i,
    global: /\b(?:spz|Spiralyze|__SPZ__)\b/,
    classId: /\bspz[-_]/i,
  },
  {
    vendor: "Optimizely",
    script: /optimizely/i,
    global: /\boptimizely\b/,
    classId: /(?:^|[\s"'#.])optimizely/i,
  },
  {
    vendor: "VWO",
    script: /visualwebsiteoptimizer|dev\.visualwebsiteoptimizer|\bvwo\.com\b/i,
    global: /\b(?:_vwo_code|VWO)\b/,
    classId: /\bvwo[-_]/i,
  },
  {
    vendor: "Convert",
    script: /convertexperiments|cdn-3\.convert\.com|convert\.com\/js/i,
    global: /\b_conv_q\b/,
    classId: /\bconvert[-_]/i,
  },
  {
    vendor: "AB Tasty",
    script: /abtasty/i,
    global: /\bABTasty\b/,
    classId: /\babtasty[-_]/i,
  },
  {
    vendor: "Adobe Target",
    script: /mbox\.js|tt\.omtrdc\.net|adobe\.com\/target/i,
    global: /\badobe\.target\b/,
    classId: /\bat-element-marker\b/,
  },
  {
    vendor: "Mutiny",
    script: /mutinyhq|client\.mutiny/i,
    global: /\bmutiny\b/,
    classId: /\bmutiny[-_]/i,
  },
  {
    vendor: "Kameleoon",
    script: /kameleoon/i,
    global: /\bkameleoon\b/,
    classId: /\bkameleoon[-_]/i,
  },
];

/**
 * Detect a live A/B runner from script/iframe URLs, class/id tokens, and
 * script bodies — never from visible marketing copy ("we run A/B tests").
 */
export function detectLiveTestFromSignals(
  input: LiveTestSignals
): LiveTestHit | null {
  const urls = [...input.scriptSrcs, ...input.iframeSrcs].join(" ");
  for (const v of VENDORS) {
    if (
      v.script.test(urls) ||
      v.classId.test(input.classIds) ||
      v.global.test(input.scriptBodies)
    ) {
      return { vendor: v.vendor };
    }
  }
  return null;
}

export function detectLiveTestFromHtml(html: string): LiveTestHit | null {
  const scriptSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)/gi)].map(
    (m) => m[1]
  );
  const iframeSrcs = [...html.matchAll(/<iframe[^>]+src=["']([^"']+)/gi)].map(
    (m) => m[1]
  );
  const classIds = [...html.matchAll(/\s(?:class|id)=["']([^"']+)/gi)]
    .map((m) => m[1])
    .join(" ");
  const scriptBodies = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .join("\n");
  return detectLiveTestFromSignals({
    scriptSrcs,
    iframeSrcs,
    classIds,
    scriptBodies,
  });
}

/**
 * Runs inside the headless page. Self-contained so Puppeteer can serialize it.
 * Hides preview / QA / error chrome only — not variant-tagged content.
 */
export function inspectAndHideLiveTestInPage(): LiveTestInspectResult {
  const scriptSrcs = Array.from(document.scripts)
    .map((s) => s.src || "")
    .filter(Boolean);
  const iframeSrcs = Array.from(document.querySelectorAll("iframe"))
    .map((f) => f.src || "")
    .filter(Boolean);
  const classIds = [
    ...Array.from(document.querySelectorAll("[class]")).map((el) =>
      el.getAttribute("class")
    ),
    ...Array.from(document.querySelectorAll("[id]")).map((el) => el.id),
  ]
    .filter(Boolean)
    .join(" ");
  const scriptBodies = Array.from(document.scripts)
    .map((s) => s.textContent || "")
    .join("\n");

  const urlBlob = [...scriptSrcs, ...iframeSrcs].join(" ");
  const vendors: { vendor: string; script: RegExp; global: RegExp; classId: RegExp }[] =
    [
      {
        vendor: "Spiralyze",
        script: /spiralyze/i,
        global: /\b(?:spz|Spiralyze|__SPZ__)\b/,
        classId: /\bspz[-_]/i,
      },
      {
        vendor: "Optimizely",
        script: /optimizely/i,
        global: /\boptimizely\b/,
        classId: /(?:^|[\s"'#.])optimizely/i,
      },
      {
        vendor: "VWO",
        script: /visualwebsiteoptimizer|dev\.visualwebsiteoptimizer|\bvwo\.com\b/i,
        global: /\b(?:_vwo_code|VWO)\b/,
        classId: /\bvwo[-_]/i,
      },
      {
        vendor: "Convert",
        script: /convertexperiments|cdn-3\.convert\.com|convert\.com\/js/i,
        global: /\b_conv_q\b/,
        classId: /\bconvert[-_]/i,
      },
      {
        vendor: "AB Tasty",
        script: /abtasty/i,
        global: /\bABTasty\b/,
        classId: /\babtasty[-_]/i,
      },
      {
        vendor: "Adobe Target",
        script: /mbox\.js|tt\.omtrdc\.net|adobe\.com\/target/i,
        global: /\badobe\.target\b/,
        classId: /\bat-element-marker\b/,
      },
      {
        vendor: "Mutiny",
        script: /mutinyhq|client\.mutiny/i,
        global: /\bmutiny\b/,
        classId: /\bmutiny[-_]/i,
      },
      {
        vendor: "Kameleoon",
        script: /kameleoon/i,
        global: /\bkameleoon\b/,
        classId: /\bkameleoon[-_]/i,
      },
    ];

  const globalKeys: Record<string, string[]> = {
    Spiralyze: ["spz", "Spiralyze", "__SPZ__"],
    Optimizely: ["optimizely"],
    VWO: ["_vwo_code", "VWO"],
    Convert: ["_conv_q"],
    "AB Tasty": ["ABTasty"],
    Mutiny: ["mutiny"],
    Kameleoon: ["kameleoon"],
  };

  let vendor: string | null = null;
  for (const v of vendors) {
    const keys = globalKeys[v.vendor] ?? [];
    const hasGlobal = keys.some((k) => {
      try {
        return (window as unknown as Record<string, unknown>)[k] != null;
      } catch {
        return false;
      }
    });
    if (
      v.script.test(urlBlob) ||
      v.classId.test(classIds) ||
      v.global.test(scriptBodies) ||
      hasGlobal
    ) {
      vendor = v.vendor;
      break;
    }
  }

  const hideSelectors = [
    '[class*="spz-preview"]',
    '[class*="spz-debug"]',
    '[class*="spz-qa"]',
    '[class*="spz-overlay"]',
    '[class*="spz-banner"]',
    '[class*="spz-error"]',
    '[id*="spz-preview"]',
    '[id*="spz-editor"]',
    "[data-spz-preview]",
    ".optimizely-preview",
    "#optly-preview",
    '[class*="optimizely-preview"]',
    "#vwo-preview",
    ".vwo-preview",
    '[class*="vwo-preview"]',
    '[class*="abtasty-preview"]',
    '[class*="convert-preview"]',
  ];

  let hidden = 0;
  const hide = (el: Element) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.dataset.croHiddenTest === "1") return;
    el.dataset.croHiddenTest = "1";
    el.style.setProperty("display", "none", "important");
    hidden += 1;
  };

  for (const sel of hideSelectors) {
    document.querySelectorAll(sel).forEach(hide);
  }

  if (vendor) {
    const chromeRe =
      /spiralyze|spz error|optimizely|visual website optimizer|\bvwo\b|preview mode|experiment debug/i;
    document
      .querySelectorAll('[role="alert"], [class*="error"], [class*="toast"]')
      .forEach((el) => {
        const text = (el.textContent || "").slice(0, 240);
        if (chromeRe.test(text)) hide(el);
      });
  }

  return { vendor, hidden };
}
