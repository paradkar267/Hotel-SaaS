import { hashPassword } from "../lib/hash.js";
import crypto from "crypto";

async function main() {
  const email = "bizleap1@gmail.com";
  const password = "bizleap@123";
  const name = "Admin";
  const tenantId = "tenant_primary";
  const propertyId = "property_main";
  
  const hashedPassword = await hashPassword(password);
  const now = new Date().toISOString();
  const userId = `usr_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
  
  const sql = `
    INSERT INTO tenants (id, name, created_at) VALUES ('${tenantId}', 'HotelOS Primary Tenant', '${now}') ON CONFLICT(id) DO NOTHING;
    INSERT INTO properties (id, tenant_id, name, address, city, state, currency, default_gst_bps, created_at, updated_at)
       VALUES ('${propertyId}', '${tenantId}', 'The Meridian House', '18 Residency Road', 'Pune', 'Maharashtra', 'INR', 1200, '${now}', '${now}') ON CONFLICT(id) DO NOTHING;
    INSERT INTO users (id, tenant_id, property_id, email, name, password_hash, role, is_active, created_by, created_at, updated_at)
       VALUES ('${userId}', '${tenantId}', '${propertyId}', '${email}', '${name}', '${hashedPassword}', 'ADMIN', 1, '${userId}', '${now}', '${now}')
       ON CONFLICT(email) DO UPDATE SET password_hash = '${hashedPassword}';
  `;

  console.log("Generated SQL for seeding admin user:");
  console.log(sql);
  
  console.log("\n\nTo execute this locally against Wrangler D1, run the following:");
  console.log(`npx wrangler d1 execute DB --local --command="INSERT INTO tenants (id, name, created_at) VALUES ('${tenantId}', 'HotelOS Primary Tenant', '${now}') ON CONFLICT(id) DO NOTHING; INSERT INTO properties (id, tenant_id, name, address, city, state, currency, default_gst_bps, created_at, updated_at) VALUES ('${propertyId}', '${tenantId}', 'The Meridian House', '18 Residency Road', 'Pune', 'Maharashtra', 'INR', 1200, '${now}', '${now}') ON CONFLICT(id) DO NOTHING; INSERT INTO users (id, tenant_id, property_id, email, name, password_hash, role, is_active, created_by, created_at, updated_at) VALUES ('${userId}', '${tenantId}', '${propertyId}', '${email}', '${name}', '${hashedPassword}', 'ADMIN', 1, '${userId}', '${now}', '${now}') ON CONFLICT(email) DO UPDATE SET password_hash = '${hashedPassword}';"`);
}

main().catch(console.error);
