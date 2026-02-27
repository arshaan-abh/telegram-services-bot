import { env } from "../config/env.js";

export function addVercelProtectionBypassToUrl(
  inputUrl: string,
  bypassSecret = env.VERCEL_PROTECTION_BYPASS_SECRET,
): string {
  if (!bypassSecret) {
    return inputUrl;
  }

  const url = new URL(inputUrl);
  url.searchParams.set("x-vercel-protection-bypass", bypassSecret);
  return url.toString();
}

export function createVercelProtectionBypassHeaders(
  bypassSecret = env.VERCEL_PROTECTION_BYPASS_SECRET,
): Record<string, string> {
  if (!bypassSecret) {
    return {};
  }

  return {
    "x-vercel-protection-bypass": bypassSecret,
  };
}
