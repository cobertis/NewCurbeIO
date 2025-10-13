import { db } from "./db";
import { users, organizations } from "@shared/schema";
import { eq } from "drizzle-orm";

async function migrateToOrganizations() {
  try {
    console.log("🚀 Iniciando migración a sistema de organizaciones...");

    // 1. Crear organización por defecto
    const [defaultOrg] = await db
      .insert(organizations)
      .values({
        name: "Curbe Organization",
        domain: "curbe.io",
      })
      .returning();
    
    console.log("✅ Organización por defecto creada:", defaultOrg.name);

    // 2. Actualizar usuario admin existente a superadmin
    const adminUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "hello@curbe.io"))
      .limit(1);

    if (adminUser.length > 0) {
      await db
        .update(users)
        .set({ 
          role: "superadmin",
          organizationId: null
        })
        .where(eq(users.id, adminUser[0].id));
      
      console.log("✅ Usuario admin actualizado a superadmin");
    }

    // 3. Actualizar resto de usuarios a org_user y asignar a organización por defecto
    await db
      .update(users)
      .set({ 
        role: "org_user",
        organizationId: defaultOrg.id
      })
      .where(eq(users.role, "viewer"));

    await db
      .update(users)
      .set({ 
        role: "org_user",
        organizationId: defaultOrg.id
      })
      .where(eq(users.role, "moderator"));

    console.log("✅ Usuarios existentes migrados a la organización por defecto");

    console.log("🎉 Migración completada exitosamente!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en la migración:", error);
    process.exit(1);
  }
}

migrateToOrganizations();
