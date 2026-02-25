import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureExceptionMock, loggerErrorMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("../../src/observability/sentry.js", () => ({
  Sentry: {
    captureException: captureExceptionMock,
  },
}));

vi.mock("../../src/observability/logger.js", () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

import { withApiErrorBoundary } from "../../src/utils/api-handler.js";

type TestRequest = {
  method?: string;
  url?: string;
  headers?: Record<string, string | undefined>;
};

function createResponse() {
  const response: {
    headersSent: boolean;
    statusCode: number | null;
    body: unknown;
    headers: Record<string, string>;
    status: (code: number) => typeof response;
    json: (value: unknown) => typeof response;
    setHeader: (name: string, value: string) => void;
  } = {
    headersSent: false,
    statusCode: null,
    body: null,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      this.body = value;
      this.headersSent = true;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
  };

  return response;
}

describe("withApiErrorBoundary", () => {
  beforeEach(() => {
    captureExceptionMock.mockReset();
    loggerErrorMock.mockReset();
  });

  it("passes through successful handlers", async () => {
    const wrapped = withApiErrorBoundary((_req, res) => {
      res.status(200).json({ ok: true });
    });

    const req = {
      method: "GET",
      url: "/api/health",
      headers: {},
    } as TestRequest;
    const res = createResponse();

    await wrapped(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("captures and translates unhandled errors to 500 response", async () => {
    const wrapped = withApiErrorBoundary(() => {
      throw new Error("boom");
    });

    const req = {
      method: "POST",
      url: "/api/test",
      headers: {},
    } as TestRequest;
    const res = createResponse();

    await wrapped(req as never, res as never);

    expect(res.statusCode).toBe(500);
    const body = res.body as {
      ok: boolean;
      error: string;
      requestId: string;
    };

    expect(body.ok).toBe(false);
    expect(body.error).toBe("internal_error");
    expect(typeof body.requestId).toBe("string");
    expect(res.headers["x-request-id"]).toEqual(expect.any(String));
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
  });
});
