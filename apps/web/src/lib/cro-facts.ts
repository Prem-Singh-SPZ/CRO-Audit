export type CroFactVisual =
  | "cta"
  | "form"
  | "social"
  | "speed"
  | "headline"
  | "trust"
  | "urgency"
  | "contrast"
  | "mobile"
  | "whitespace"
  | "benefits"
  | "video";

export interface CroFact {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  visual: CroFactVisual;
}

const LAST_FACT_KEY = "cro-wait-last-fact";

export const CRO_FACTS: CroFact[] = [
  {
    id: "cta",
    eyebrow: "Did you know?",
    title: "The shy button loses",
    body: "People click the thing that looks clickable. A faint “Submit” is a treasure hunt, not a CTA.",
    visual: "cta",
  },
  {
    id: "form",
    eyebrow: "Fun CRO fact",
    title: "Every extra field is a tiny breakup",
    body: "Ask for what you need now. Save the life story for after they say yes.",
    visual: "form",
  },
  {
    id: "social",
    eyebrow: "Did you know?",
    title: "Humans copy other humans",
    body: "A name, a face, or a real quote next to the ask beats “trusted by industry leaders.”",
    visual: "social",
  },
  {
    id: "speed",
    eyebrow: "Fun CRO fact",
    title: "A slow hero is a closed tab",
    body: "If the first screen takes a coffee break, the visitor already left.",
    visual: "speed",
  },
  {
    id: "headline",
    eyebrow: "Did you know?",
    title: "“Welcome” is not a promise",
    body: "Say what they get. Arriving on the page is not a benefit.",
    visual: "headline",
  },
  {
    id: "trust",
    eyebrow: "Fun CRO fact",
    title: "Badges work when they look real",
    body: "A couple of recognizable logos beat a wall of mystery seals.",
    visual: "trust",
  },
  {
    id: "urgency",
    eyebrow: "Did you know?",
    title: "Fake countdowns get real eye-rolls",
    body: "Scarcity helps when it’s true. Invented timers train people to ignore you.",
    visual: "urgency",
  },
  {
    id: "contrast",
    eyebrow: "Fun CRO fact",
    title: "If it blends in, it didn’t happen",
    body: "Your primary button should not play hide-and-seek with the background.",
    visual: "contrast",
  },
  {
    id: "mobile",
    eyebrow: "Did you know?",
    title: "Thumbs are not laser pointers",
    body: "Big tap targets win. The tiny “X” next to the form is a conversion gremlin.",
    visual: "mobile",
  },
  {
    id: "whitespace",
    eyebrow: "Fun CRO fact",
    title: "Crowded pages feel expensive — the wrong way",
    body: "Give the offer room to breathe. Busy layouts make people bounce, not buy.",
    visual: "whitespace",
  },
  {
    id: "benefits",
    eyebrow: "Did you know?",
    title: "Features tell. Outcomes sell.",
    body: "“Looks pretty” is a compliment. “Book a demo in two minutes” is a reason.",
    visual: "benefits",
  },
  {
    id: "video",
    eyebrow: "Fun CRO fact",
    title: "Autoplay-with-sound is a jump scare",
    body: "Motion can help. Surprise audio helps you get blocked.",
    visual: "video",
  },
  {
    id: "fold-cta",
    eyebrow: "Did you know?",
    title: "If they have to scroll to say yes, many won’t",
    body: "Put the ask on the first screen. A CTA below the fold is a scavenger hunt.",
    visual: "cta",
  },
  {
    id: "one-action",
    eyebrow: "Fun CRO fact",
    title: "Two primary buttons is zero primary buttons",
    body: "Pick one next step. Competing “Buy” and “Learn more” is how people pick neither.",
    visual: "contrast",
  },
  {
    id: "form-errors",
    eyebrow: "Did you know?",
    title: "Mystery errors feel like a trap",
    body: "Say which field broke and how to fix it. “Invalid input” is a shrug, not help.",
    visual: "form",
  },
  {
    id: "logo-graveyard",
    eyebrow: "Fun CRO fact",
    title: "A logo wall is not proof",
    body: "One named quote beats twelve gray logos nobody can read from the couch.",
    visual: "trust",
  },
  {
    id: "pricing-surprise",
    eyebrow: "Did you know?",
    title: "Hidden price is a trust tax",
    body: "If the number only appears after six clicks, people assume the worst number.",
    visual: "headline",
  },
  {
    id: "hero-vs-offer",
    eyebrow: "Fun CRO fact",
    title: "A pretty hero is not the offer",
    body: "The photo can wait. The first line should say what they get, not what the stock model is doing.",
    visual: "benefits",
  },
  {
    id: "sticky-cta",
    eyebrow: "Did you know?",
    title: "The ask should travel with the thumb",
    body: "A sticky “Get demo” on long pages beats sending people back to the top to convert.",
    visual: "mobile",
  },
  {
    id: "learn-more-leak",
    eyebrow: "Fun CRO fact",
    title: "“Learn more” is a polite exit",
    body: "It’s a hallway, not a close. If you want the demo, ask for the demo.",
    visual: "cta",
  },
];

export function shuffledCroFacts(): CroFact[] {
  const copy = [...CRO_FACTS];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Shuffle, then rotate so this wait does not open on the last opening tip. */
export function pickCroFactsDeck(): CroFact[] {
  const deck = shuffledCroFacts();
  if (deck.length < 2) return deck;

  let last: string | null = null;
  try {
    if (typeof sessionStorage !== "undefined") {
      last = sessionStorage.getItem(LAST_FACT_KEY);
    }
  } catch {
    last = null;
  }

  if (last && deck[0]?.id === last) {
    const first = deck.shift();
    if (first) deck.push(first);
  }

  try {
    if (typeof sessionStorage !== "undefined" && deck[0]) {
      sessionStorage.setItem(LAST_FACT_KEY, deck[0].id);
    }
  } catch {
    /* private mode / SSR */
  }

  return deck;
}
