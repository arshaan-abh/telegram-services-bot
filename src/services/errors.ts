export class DomainError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, options: { statusCode: number; code: string }) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = options.statusCode;
    this.code = options.code;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, code = "validation_error") {
    super(message, { statusCode: 400, code });
  }
}

export class AuthorizationError extends DomainError {
  constructor(message: string, code = "authorization_error") {
    super(message, { statusCode: 403, code });
  }
}

export class StateConflictError extends DomainError {
  constructor(message: string, code = "state_conflict") {
    super(message, { statusCode: 409, code });
  }
}

export class ExternalApiError extends DomainError {
  constructor(message: string, code = "external_api_error") {
    super(message, { statusCode: 502, code });
  }
}
