import { requireAuth } from "@/lib/requireUser";
import { POST as generateSite } from "../generate-site/route";

/** @deprecated используйте /api/generate-site */
export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.user) return auth.error!;
  return generateSite(request);
}
