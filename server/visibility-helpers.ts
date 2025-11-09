import type { User } from "@shared/schema";

/**
 * Determines if a user should see all company data regardless of ownership
 * @param user - The user to check
 * @returns true if user should see all company data, false otherwise
 */
export function shouldViewAllCompanyData(user: User): boolean {
  return user.role === 'superadmin' || user.viewAllCompanyData === true;
}
