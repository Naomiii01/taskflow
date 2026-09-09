/** Shared error types thrown by service-layer functions and mapped to HTTP
 * status codes in `handleApiError` (src/lib/api-utils.ts). Kept in one place
 * so every service's `instanceof` check resolves against the same class. */

export class PermissionError extends Error {
  constructor(message = "沒有權限執行此操作") {
    super(message);
    this.name = "PermissionError";
  }
}

export class UnauthorizedError extends Error {}
