import { writeFileSync } from "fs";
import { captureScreenshots } from "../src/lib/screenshot";

const r = await captureScreenshots("https://www.adherent.com/book-a-demo/");
const summary = {
  blocked: r.blockedReason,
  incomplete: r.incompleteCapture,
  note: r.captureNote,
  liveUsable: r.liveUsable,
  shots: r.screenshots.length,
  w: r.screenshots[0]?.width ?? null,
  h: r.screenshots[0]?.height ?? null,
  bands: r.bands.length,
  lead: r.leadForm.fields,
  leadCount: r.leadForm.fields.length,
  landmarks: r.landmarks.map((l) => l.id),
  source: r.screenshotSource,
};
console.log(JSON.stringify(summary, null, 2));
writeFileSync(
  "E:/React_Projects/cro-audit-ai/adherent-repro.json",
  JSON.stringify(summary, null, 2)
);
const shot = r.screenshots[0] ?? r.heroShot;
if (shot?.dataUri) {
  writeFileSync(
    "E:/React_Projects/cro-audit-ai/adherent-repro.jpg",
    Buffer.from(shot.dataUri.replace(/^data:image\/\w+;base64,/, ""), "base64")
  );
  console.log("wrote jpg bytes", shot.dataUri.length);
} else {
  console.log("NO SHOT");
}
process.exit(r.incompleteCapture || !r.leadForm.fields.length ? 1 : 0);
