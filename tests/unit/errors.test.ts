import { describe, expect, it } from "vitest";

import {
  AuthorizationError,
  DomainError,
  ExternalApiError,
  StateConflictError,
  ValidationError,
} from "../../src/services/errors.js";

describe("domain errors", () => {
  it("captures status code and machine-readable code", () => {
    const error = new DomainError("boom", {
      statusCode: 418,
      code: "teapot",
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DomainError");
    expect(error.statusCode).toBe(418);
    expect(error.code).toBe("teapot");
  });

  it("uses defaults for specialized domain errors", () => {
    const validation = new ValidationError("bad");
    expect(validation.statusCode).toBe(400);
    expect(validation.code).toBe("validation_error");

    const authorization = new AuthorizationError("forbidden");
    expect(authorization.statusCode).toBe(403);
    expect(authorization.code).toBe("authorization_error");

    const conflict = new StateConflictError("conflict");
    expect(conflict.statusCode).toBe(409);
    expect(conflict.code).toBe("state_conflict");

    const external = new ExternalApiError("upstream");
    expect(external.statusCode).toBe(502);
    expect(external.code).toBe("external_api_error");
  });

  it("allows overriding default codes", () => {
    const validation = new ValidationError("bad", "bad_input");
    const authorization = new AuthorizationError("forbidden", "admin_required");
    const conflict = new StateConflictError("conflict", "already_done");
    const external = new ExternalApiError("upstream", "provider_timeout");

    expect(validation.code).toBe("bad_input");
    expect(authorization.code).toBe("admin_required");
    expect(conflict.code).toBe("already_done");
    expect(external.code).toBe("provider_timeout");
  });
});
