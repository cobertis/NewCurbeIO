import { db } from '../db';
import { apiCredentials } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { CredentialNotFoundError } from '../lib/errors';

/**
 * Obtiene una credencial de forma segura para una compañía específica.
 * NUNCA usar process.env para credenciales de APIs de terceros.
 * 
 * @param companyId - ID de la compañía (OBLIGATORIO para multi-tenant security)
 * @param service - Nombre del servicio (ej: 'telnyx', 'stripe', 'intercom')
 * @param key - Nombre de la credencial (ej: 'api_key', 'secret_key')
 * @returns El valor de la credencial (desencriptado si aplica)
 * @throws {CredentialNotFoundError} Si la credencial no existe
 */
export async function getCompanyCredential(
  companyId: string,
  service: string,
  key: string
): Promise<string> {
  if (!companyId || !service || !key) {
    throw new Error('companyId, service, and key are required');
  }

  const environment = process.env.NODE_ENV || 'production';

  try {
    const result = await db
      .select({ 
        value: apiCredentials.value,
        encrypted: apiCredentials.encrypted
      })
      .from(apiCredentials)
      .where(
        and(
          eq(apiCredentials.companyId, companyId),
          eq(apiCredentials.service, service),
          eq(apiCredentials.key, key),
          eq(apiCredentials.environment, environment)
        )
      )
      .limit(1);

    if (!result || result.length === 0) {
      throw new CredentialNotFoundError(service, key, companyId);
    }

    const credential = result[0];
    
    // TODO: Implementar desencriptación cuando esté listo
    // if (credential.encrypted) {
    //   return decryptCredential(credential.value);
    // }
    
    return credential.value;
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      throw error;
    }
    
    console.error('[CredentialProvider] Error fetching credential:', {
      companyId,
      service,
      key,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw new Error(`Failed to fetch credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Valida que una compañía tenga configurada una credencial específica.
 * Útil para validar antes de ejecutar operaciones que requieren la credencial.
 */
export async function validateCompanyHasCredential(
  companyId: string,
  service: string,
  key: string
): Promise<boolean> {
  try {
    await getCompanyCredential(companyId, service, key);
    return true;
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      return false;
    }
    throw error;
  }
}

/**
 * Obtiene TODAS las credenciales de un servicio para una compañía.
 * Útil cuando necesitas múltiples credenciales del mismo servicio.
 */
export async function getCompanyServiceCredentials(
  companyId: string,
  service: string
): Promise<Record<string, string>> {
  const environment = process.env.NODE_ENV || 'production';

  try {
    const results = await db
      .select({ 
        key: apiCredentials.key,
        value: apiCredentials.value,
        encrypted: apiCredentials.encrypted
      })
      .from(apiCredentials)
      .where(
        and(
          eq(apiCredentials.companyId, companyId),
          eq(apiCredentials.service, service),
          eq(apiCredentials.environment, environment)
        )
      );

    if (!results || results.length === 0) {
      throw new CredentialNotFoundError(service, '*', companyId);
    }

    const credentials: Record<string, string> = {};
    
    for (const cred of results) {
      // TODO: Implementar desencriptación
      credentials[cred.key] = cred.value;
    }

    return credentials;
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      throw error;
    }
    
    console.error('[CredentialProvider] Error fetching service credentials:', {
      companyId,
      service,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw new Error(`Failed to fetch ${service} credentials`);
  }
}

/**
 * Helper para crear headers de autenticación con credenciales de la compañía.
 */
export async function getCompanyAuthHeaders(
  companyId: string,
  service: string,
  headerType: 'Bearer' | 'Basic' | 'ApiKey' = 'Bearer'
): Promise<Record<string, string>> {
  const apiKey = await getCompanyCredential(companyId, service, 'api_key');

  switch (headerType) {
    case 'Bearer':
      return {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };
    
    case 'Basic':
      const encoded = Buffer.from(`${apiKey}:`).toString('base64');
      return {
        'Authorization': `Basic ${encoded}`,
        'Content-Type': 'application/json'
      };
    
    case 'ApiKey':
      return {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      };
    
    default:
      throw new Error(`Unsupported header type: ${headerType}`);
  }
}
