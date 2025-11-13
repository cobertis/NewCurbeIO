import { db } from "../db";
import { campaignTemplateCategories, campaignPlaceholders, campaignTemplates } from "@shared/schema";
import { eq, and, isNull, isNotNull } from "drizzle-orm";

/**
 * Seeds system data for Campaign Studio:
 * - Template categories
 * - System placeholders
 * - Sample templates
 * 
 * Only runs if no system categories exist yet.
 */
export async function seedCampaignStudioData(): Promise<void> {
  try {
    console.log('[Campaign Studio] Running data backfill...');
    
    const fixedTemplates = await db
      .update(campaignTemplates)
      .set({ companyId: null })
      .where(
        and(
          eq(campaignTemplates.isSystem, true),
          isNotNull(campaignTemplates.companyId)
        )
      )
      .returning();
    console.log(`[Campaign Studio] Fixed ${fixedTemplates.length} system templates`);
    
    const fixedCategories = await db
      .update(campaignTemplateCategories)
      .set({ companyId: null })
      .where(
        and(
          eq(campaignTemplateCategories.isSystem, true),
          isNotNull(campaignTemplateCategories.companyId)
        )
      )
      .returning();
    console.log(`[Campaign Studio] Fixed ${fixedCategories.length} system categories`);
    
    const fixedPlaceholders = await db
      .update(campaignPlaceholders)
      .set({ companyId: null })
      .where(
        and(
          eq(campaignPlaceholders.isSystem, true),
          isNotNull(campaignPlaceholders.companyId)
        )
      )
      .returning();
    console.log(`[Campaign Studio] Fixed ${fixedPlaceholders.length} system placeholders`);

    const existingCategories = await db
      .select()
      .from(campaignTemplateCategories)
      .where(
        and(
          isNull(campaignTemplateCategories.companyId),
          eq(campaignTemplateCategories.isSystem, true)
        )
      )
      .limit(1);

    if (existingCategories.length > 0) {
      console.log('[Campaign Studio] System data already exists, skipping seed');
      return;
    }

    console.log('[Campaign Studio] Seeding system data...');

    const categories = [
      {
        name: "Welcome Messages",
        description: "Greet new customers and introduce your services",
        icon: "HandHeart",
        displayOrder: 1,
        isSystem: true,
        companyId: null,
      },
      {
        name: "Promotions",
        description: "Special offers, discounts, and sales announcements",
        icon: "Tag",
        displayOrder: 2,
        isSystem: true,
        companyId: null,
      },
      {
        name: "Follow-ups",
        description: "Check-ins, reminders, and post-purchase messages",
        icon: "MessageCircleReply",
        displayOrder: 3,
        isSystem: true,
        companyId: null,
      },
      {
        name: "Reminders",
        description: "Appointment reminders, deadline notifications",
        icon: "Bell",
        displayOrder: 4,
        isSystem: true,
        companyId: null,
      },
      {
        name: "Seasonal",
        description: "Holiday greetings and seasonal campaigns",
        icon: "Sparkles",
        displayOrder: 5,
        isSystem: true,
        companyId: null,
      },
      {
        name: "Announcements",
        description: "Company updates and important news",
        icon: "Megaphone",
        displayOrder: 6,
        isSystem: true,
        companyId: null,
      },
    ];

    const insertedCategories = await db.insert(campaignTemplateCategories).values(categories).returning();
    console.log(`[Campaign Studio] Created ${insertedCategories.length} system categories`);

    const categoryMap = new Map(insertedCategories.map(cat => [cat.name, cat.id]));

    const placeholders = [
      {
        name: "firstName",
        label: "First Name",
        fieldPath: "contact.firstName",
        fallbackValue: "there",
        dataType: "string" as const,
        isSystem: true,
        isActive: true,
        companyId: null,
      },
      {
        name: "lastName",
        label: "Last Name",
        fieldPath: "contact.lastName",
        fallbackValue: "",
        dataType: "string" as const,
        isSystem: true,
        isActive: true,
        companyId: null,
      },
      {
        name: "fullName",
        label: "Full Name",
        fieldPath: "contact.fullName",
        fallbackValue: "Customer",
        dataType: "string" as const,
        isSystem: true,
        isActive: true,
        companyId: null,
      },
      {
        name: "email",
        label: "Email",
        fieldPath: "contact.email",
        fallbackValue: "",
        dataType: "string" as const,
        isSystem: true,
        isActive: true,
        companyId: null,
      },
      {
        name: "phone",
        label: "Phone",
        fieldPath: "contact.phone",
        fallbackValue: "",
        dataType: "string" as const,
        isSystem: true,
        isActive: true,
        companyId: null,
      },
      {
        name: "companyName",
        label: "Company Name",
        fieldPath: "company.name",
        fallbackValue: "our team",
        dataType: "string" as const,
        isSystem: true,
        isActive: true,
        companyId: null,
      },
      {
        name: "agentName",
        label: "Agent Name",
        fieldPath: "user.firstName",
        fallbackValue: "us",
        dataType: "string" as const,
        isSystem: true,
        isActive: true,
        companyId: null,
      },
    ];

    const insertedPlaceholders = await db.insert(campaignPlaceholders).values(placeholders).returning();
    console.log(`[Campaign Studio] Created ${insertedPlaceholders.length} system placeholders`);

    const templates = [
      {
        categoryId: categoryMap.get("Welcome Messages")!,
        name: "New Customer Welcome",
        description: "Friendly welcome message for new customers",
        messageBody: "Hi {{firstName}}! 👋 Welcome to {{companyName}}. We're thrilled to have you with us. Reply HELP for assistance anytime!",
        placeholders: ["firstName", "companyName"],
        mediaUrls: [],
        isSystem: true,
        companyId: null,
        createdBy: null,
      },
      {
        categoryId: categoryMap.get("Welcome Messages")!,
        name: "Service Introduction",
        description: "Personal introduction from an agent",
        messageBody: "Hello {{fullName}}, thanks for choosing {{companyName}}. I'm {{agentName}}, and I'll be helping you get started. What can I assist you with today?",
        placeholders: ["fullName", "companyName", "agentName"],
        mediaUrls: [],
        isSystem: true,
        companyId: null,
        createdBy: null,
      },
      {
        categoryId: categoryMap.get("Promotions")!,
        name: "Limited Time Offer",
        description: "Create urgency with a time-sensitive promotion",
        messageBody: "Hey {{firstName}}! 🎉 Special offer just for you: [OFFER DETAILS]. Valid until [DATE]. Reply YES to claim!",
        placeholders: ["firstName"],
        mediaUrls: [],
        isSystem: true,
        companyId: null,
        createdBy: null,
      },
      {
        categoryId: categoryMap.get("Promotions")!,
        name: "Flash Sale Alert",
        description: "Alert customers about a flash sale",
        messageBody: "Hi {{fullName}}! Flash sale happening now at {{companyName}}. Don't miss out - reply for details!",
        placeholders: ["fullName", "companyName"],
        mediaUrls: [],
        isSystem: true,
        companyId: null,
        createdBy: null,
      },
      {
        categoryId: categoryMap.get("Follow-ups")!,
        name: "Post-Purchase Check-in",
        description: "Follow up after a purchase",
        messageBody: "Hi {{firstName}}, hope you're enjoying your recent purchase! Any questions? We're here to help.",
        placeholders: ["firstName"],
        mediaUrls: [],
        isSystem: true,
        companyId: null,
        createdBy: null,
      },
      {
        categoryId: categoryMap.get("Follow-ups")!,
        name: "General Follow-up",
        description: "Check in with customers",
        messageBody: "Hello {{fullName}}, just checking in from {{companyName}}. How are things going? Any updates you'd like to share?",
        placeholders: ["fullName", "companyName"],
        mediaUrls: [],
        isSystem: true,
        companyId: null,
        createdBy: null,
      },
      {
        categoryId: categoryMap.get("Reminders")!,
        name: "Appointment Reminder",
        description: "Remind customers about upcoming appointments",
        messageBody: "Hi {{firstName}}, this is {{agentName}} from {{companyName}}. Reminder: You have an appointment on [DATE] at [TIME]. Reply C to confirm.",
        placeholders: ["firstName", "agentName", "companyName"],
        mediaUrls: [],
        isSystem: true,
        companyId: null,
        createdBy: null,
      },
      {
        categoryId: categoryMap.get("Reminders")!,
        name: "Payment Reminder",
        description: "Friendly payment due date reminder",
        messageBody: "Hello {{fullName}}, friendly reminder that your payment for [SERVICE] is due on [DATE]. Reply with questions!",
        placeholders: ["fullName"],
        mediaUrls: [],
        isSystem: true,
        companyId: null,
        createdBy: null,
      },
      {
        categoryId: categoryMap.get("Seasonal")!,
        name: "Holiday Greetings",
        description: "Send warm holiday wishes",
        messageBody: "Happy Holidays from {{companyName}}, {{firstName}}! 🎄 Wishing you and yours a wonderful season!",
        placeholders: ["companyName", "firstName"],
        mediaUrls: [],
        isSystem: true,
        companyId: null,
        createdBy: null,
      },
      {
        categoryId: categoryMap.get("Seasonal")!,
        name: "Birthday Wishes",
        description: "Celebrate customer birthdays",
        messageBody: "Happy Birthday {{firstName}}! 🎂 The team at {{companyName}} wishes you an amazing day!",
        placeholders: ["firstName", "companyName"],
        mediaUrls: [],
        isSystem: true,
        companyId: null,
        createdBy: null,
      },
    ];

    const insertedTemplates = await db.insert(campaignTemplates).values(templates).returning();
    console.log(`[Campaign Studio] Created ${insertedTemplates.length} system templates`);

    console.log('[Campaign Studio] System data seeded successfully');
  } catch (error: any) {
    console.error('[Campaign Studio] Error seeding system data:', error.message);
    throw error;
  }
}
