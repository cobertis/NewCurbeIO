import Intercom from '@intercom/messenger-js-sdk';

let isInitialized = false;
let currentAppId: string | null = null;

export interface IntercomUserData {
  user_id: string;
  name?: string;
  email?: string;
  phone?: string;
  created_at?: number;
  user_hash?: string;
  company?: {
    company_id: string;
    name?: string;
  };
  custom_attributes?: Record<string, string | number | boolean>;
}

export interface IntercomSettings extends IntercomUserData {
  app_id: string;
  intercom_user_jwt?: string;
}

export async function fetchIntercomJwt(): Promise<string | null> {
  try {
    const response = await fetch('/api/intercom/jwt', { credentials: 'include' });
    if (!response.ok) return null;
    const data = await response.json();
    return data.jwt || null;
  } catch (error) {
    console.warn('[Intercom] Failed to fetch JWT:', error);
    return null;
  }
}

export function boot(appId: string, userData?: IntercomUserData, jwt?: string | null): void {
  if (!appId) {
    console.warn('[Intercom] Cannot boot without app_id');
    return;
  }

  const settings: IntercomSettings & { api_base?: string } = {
    app_id: appId,
    api_base: "https://api-iam.intercom.io",
  };

  if (jwt) {
    settings.intercom_user_jwt = jwt;
    console.log('[Intercom] Using JWT for identity verification');
  } else if (userData) {
    Object.assign(settings, userData);
  }

  if (isInitialized && currentAppId === appId) {
    update(userData);
    return;
  }

  try {
    Intercom(settings);
    isInitialized = true;
    currentAppId = appId;
    console.log('[Intercom] Booted successfully', jwt ? '(with JWT)' : '(without JWT)');
  } catch (error) {
    console.error('[Intercom] Failed to boot:', error);
  }
}

export function shutdown(): void {
  if (!isInitialized) {
    return;
  }

  try {
    if (typeof window !== 'undefined' && (window as any).Intercom) {
      (window as any).Intercom('shutdown');
    }
    isInitialized = false;
    currentAppId = null;
    console.log('[Intercom] Shut down successfully');
  } catch (error) {
    console.error('[Intercom] Failed to shutdown:', error);
  }
}

export function update(userData?: Partial<IntercomUserData>): void {
  if (!isInitialized) {
    console.warn('[Intercom] Cannot update - not initialized');
    return;
  }

  try {
    if (typeof window !== 'undefined' && (window as any).Intercom) {
      (window as any).Intercom('update', userData || {});
    }
  } catch (error) {
    console.error('[Intercom] Failed to update:', error);
  }
}

export function trackEvent(eventName: string, metadata?: Record<string, string | number | boolean>): void {
  if (!isInitialized) {
    console.warn('[Intercom] Cannot track event - not initialized');
    return;
  }

  try {
    if (typeof window !== 'undefined' && (window as any).Intercom) {
      (window as any).Intercom('trackEvent', eventName, metadata);
      console.log('[Intercom] Tracked event:', eventName, metadata);
    }
  } catch (error) {
    console.error('[Intercom] Failed to track event:', error);
  }
}

export function show(): void {
  if (typeof window !== 'undefined' && (window as any).Intercom) {
    (window as any).Intercom('show');
  }
}

export function hide(): void {
  if (typeof window !== 'undefined' && (window as any).Intercom) {
    (window as any).Intercom('hide');
  }
}

export function showMessages(): void {
  if (typeof window !== 'undefined' && (window as any).Intercom) {
    (window as any).Intercom('showMessages');
  }
}

export function showNewMessage(prePopulatedContent?: string): void {
  if (typeof window !== 'undefined' && (window as any).Intercom) {
    (window as any).Intercom('showNewMessage', prePopulatedContent || '');
  }
}

export function getVisitorId(): string | null {
  if (typeof window !== 'undefined' && (window as any).Intercom) {
    return (window as any).Intercom('getVisitorId');
  }
  return null;
}

export function isBooted(): boolean {
  return isInitialized;
}
