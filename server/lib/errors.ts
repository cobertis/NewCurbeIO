/**
 * Clase base para todos los errores de la aplicación
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(process.env.NODE_ENV === 'development' && {
        context: this.context,
        stack: this.stack
      })
    };
  }
}

/**
 * Error 401 - Usuario no autenticado
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * Error 403 - Usuario no tiene permisos
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Error 404 - Recurso no encontrado
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/**
 * Error 400 - Datos de entrada inválidos
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', context);
  }
}

/**
 * Error de credenciales - Credencial no encontrada en BD
 */
export class CredentialNotFoundError extends AppError {
  constructor(service: string, key: string, companyId: string) {
    super(
      `Credential ${service}.${key} not configured for this company`,
      500,
      'CREDENTIAL_NOT_FOUND',
      { service, key, companyId }
    );
  }
}

/**
 * Error de servicio Telnyx
 */
export class TelnyxServiceError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 500, 'TELNYX_ERROR', context);
  }
}

/**
 * Error de servicio externo (APIs de terceros)
 */
export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    message: string,
    statusCode?: number,
    context?: Record<string, any>
  ) {
    super(
      `${service} error: ${message}`,
      statusCode || 500,
      'EXTERNAL_SERVICE_ERROR',
      { service, ...context }
    );
  }
}
