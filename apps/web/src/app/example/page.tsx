import { ReportView } from "@/components/report/report-view";
import { EXAMPLE_REPORT } from "@/data/example-report";

export const metadata = {
  title: "Sample CRO report",
  description:
    "A checked-in sample audit — no live scan — so you can see the report before analyzing your page.",
};

export default function ExampleReportPage() {
  return <ReportView data={EXAMPLE_REPORT} readOnly />;
}
