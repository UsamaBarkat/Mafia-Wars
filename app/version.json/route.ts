// The build that is live right now, as a static file generated at build time (no server
// code runs per request). The moderator's tab compares it with its own BUILD_ID before
// resolving a phase — see lib/buildVersion.ts.

import { BUILD_ID } from "@/lib/buildVersion";

export const dynamic = "force-static";

export function GET() {
  return Response.json({ buildId: BUILD_ID });
}
