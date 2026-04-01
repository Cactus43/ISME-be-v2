/**
 * Domain exception hierarchy.
 * All operational errors extend AppError — caught by the global ErrorHandler middleware.
 */


// ─── Base ──────────────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly StatusCode: number;
  public readonly IsOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.StatusCode = statusCode;
    this.IsOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}


// ─── Concrete errors ───────────────────────────────────────────────────────

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request') { super(message, 400); }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') { super(message, 401); }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(message, 403); }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found') { super(message, 404); }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') { super(message, 409); }
}

export class InternalError extends AppError {
  constructor(message = 'Internal Server Error') { super(message, 500, false); }
}
