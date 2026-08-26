import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getDeployVersion() {
  return (
    process.env.COMMIT_REF ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.DEPLOY_ID ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.npm_package_version ||
    "local-dev"
  );
}

export function GET() {
  return NextResponse.json(
    {
      version: getDeployVersion(),
      deployId: process.env.DEPLOY_ID || null,
      context: process.env.CONTEXT || process.env.VERCEL_ENV || null,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
