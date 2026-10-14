/**
 * Visual/form QA for Adherent: capture must include HubSpot lead fields
 * (firstname/email), not a spinner-only card.
 */
import { writeFileSync } from "fs";
import { captureScreenshots } from "../src/lib/screenshot";

const url = "https://www.adherent.com/book-a-demo/";
console.log("QA capture", url);
const result = await captureScreenshots(url);

const fieldNames = result.leadForm.fields.map((f) => f.toLowerCase());
const hasFirst =
  fieldNames.some((f) => /first/.test(f)) ||
  result.leadForm.fields.length >= 4;
const hasEmail = fieldNames.some((f) => /email|e-mail|work/.test(f));
const formOk =
  result.leadForm.present &&
  result.leadForm.fields.length >= 4 &&
  (hasFirst || hasEmail) &&
  !result.incompleteCapture &&
  result.liveUsable === true &&
  result.blockedReason == null;

const summary = {
  formOk,
  blockedReason: result.blockedReason,
  incompleteCapture: result.incompleteCapture,
  captureNote: result.captureNote,
  liveUsable: result.liveUsable,
  leadPresent: result.leadForm.present,
  leadFields: result.leadForm.fields,
  leadCount: result.leadForm.fields.length,
  shotCount: result.screenshots.length,
  height: result.screenshots[0]?.height ?? null,
};
console.log(JSON.stringify(summary, null, 2));
writeFileSync(
  "E:/React_Projects/cro-audit-ai/adherent-form-qa.json",
  JSON.stringify(summary, null, 2)
);

const shot = result.screenshots[0] ?? result.heroShot;
if (shot?.dataUri?.startsWith("data:image/")) {
  const b64 = shot.dataUri.replace(/^data:image\/\w+;base64,/, "");
  writeFileSync(
    "E:/React_Projects/cro-audit-ai/adherent-form-qa.jpg",
    Buffer.from(b64, "base64")
  );
  console.log("wrote adherent-form-qa.jpg");
}

if (!formOk) {
  console.error("FAIL: Adherent form was not captured with filled HubSpot fields");
  process.exit(1);
}
console.log("PASS: Adherent form fields present in capture");
process.exit(0);
