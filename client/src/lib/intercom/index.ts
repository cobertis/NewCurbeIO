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
  return null;
}

export function boot(_appId: string, _userData?: IntercomUserData, _jwt?: string | null): void {
}

export function shutdown(): void {
}

export function update(_userData?: Partial<IntercomUserData>): void {
}

export function trackEvent(_eventName: string, _metadata?: Record<string, string | number | boolean>): void {
}

export function show(): void {
}

export function hide(): void {
}

export function showMessages(): void {
}

export function showNewMessage(_prePopulatedContent?: string): void {
}

export function getVisitorId(): string | null {
  return null;
}

export function isBooted(): boolean {
  return false;
}
