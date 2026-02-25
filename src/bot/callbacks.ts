export function parseCallbackData(data: string): string[] {
  return data.split(":");
}

export function deriveOrderIdFromCallbackData(
  data: string | undefined,
): string | null {
  if (!data) {
    return null;
  }

  const match = data.match(
    /^v1:admin:order:(?:view|done|dismiss|contact):([a-z0-9-]+)$/i,
  );
  return match?.[1] ?? null;
}

export function buildUnknownCallbackResponse(
  data: string,
  translate: (key: string) => string,
): { text: string; show_alert?: boolean } {
  const [version] = parseCallbackData(data);
  if (version !== "v1") {
    return {
      text: translate("unknown-action"),
      show_alert: true,
    };
  }

  return {
    text: translate("unknown-action"),
  };
}
