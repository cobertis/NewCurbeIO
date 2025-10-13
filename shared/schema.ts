import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  domain: text("domain"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("org_user"),
  organizationId: varchar("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  role: z.enum(["superadmin", "org_admin", "org_user"]),
  organizationId: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["superadmin", "org_admin", "org_user"]).optional(),
  organizationId: z.string().optional(),
}).refine(data => data.email !== undefined || data.role !== undefined || data.organizationId !== undefined, {
  message: "At least one field must be provided",
});

export const updateOrganizationSchema = z.object({
  name: z.string().optional(),
  domain: z.string().optional(),
}).refine(data => data.name !== undefined || data.domain !== undefined, {
  message: "At least one field must be provided",
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
