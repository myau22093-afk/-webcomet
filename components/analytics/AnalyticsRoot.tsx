import { Suspense } from "react";
import { WebCometAnalytics } from "@/components/analytics/WebCometAnalytics";

export function AnalyticsRoot() {
  return (
    <Suspense fallback={null}>
      <WebCometAnalytics />
    </Suspense>
  );
}
