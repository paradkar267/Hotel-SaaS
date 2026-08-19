CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`actor_role` text NOT NULL,
	`action` text NOT NULL,
	`module` text NOT NULL,
	`record_id` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`old_value` text DEFAULT '{}' NOT NULL,
	`new_value` text DEFAULT '{}' NOT NULL,
	`ip_address` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_logs_tenant_id_idx` ON `audit_logs` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `audit_logs_record_idx` ON `audit_logs` (`module`,`record_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`property_id` text NOT NULL,
	`booking_number` text NOT NULL,
	`guest_id` text NOT NULL,
	`room_id` text NOT NULL,
	`check_in_at` text NOT NULL,
	`expected_check_out_at` text NOT NULL,
	`actual_check_out_at` text,
	`adults` integer DEFAULT 1 NOT NULL,
	`children` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'WALK_IN' NOT NULL,
	`status` text DEFAULT 'CHECKED_IN' NOT NULL,
	`billing_type` text DEFAULT 'NON_GST' NOT NULL,
	`company_name` text DEFAULT '' NOT NULL,
	`guest_gstin` text DEFAULT '' NOT NULL,
	`guest_state` text DEFAULT '' NOT NULL,
	`nightly_rate_paise` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`locked_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_number_unique` ON `bookings` (`booking_number`);--> statement-breakpoint
CREATE INDEX `bookings_tenant_status_idx` ON `bookings` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `bookings_room_status_idx` ON `bookings` (`room_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_booking_per_room` ON `bookings` (`room_id`) WHERE `status` = 'CHECKED_IN';--> statement-breakpoint
CREATE TABLE `guest_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`guest_id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `guest_documents_guest_idx` ON `guest_documents` (`guest_id`);--> statement-breakpoint
CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`property_id` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`state` text DEFAULT '' NOT NULL,
	`country` text DEFAULT 'India' NOT NULL,
	`postal_code` text DEFAULT '' NOT NULL,
	`nationality` text DEFAULT 'Indian' NOT NULL,
	`id_type` text DEFAULT '' NOT NULL,
	`id_last4` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `guests_tenant_name_idx` ON `guests` (`tenant_id`,`full_name`);--> statement-breakpoint
CREATE INDEX `guests_tenant_phone_idx` ON `guests` (`tenant_id`,`phone`);--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` integer NOT NULL,
	`rate_paise` integer NOT NULL,
	`amount_paise` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `invoice_items_invoice_idx` ON `invoice_items` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`property_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`booking_id` text NOT NULL,
	`billing_type` text NOT NULL,
	`gst_rate_bps` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'UNPAID' NOT NULL,
	`subtotal_paise` integer NOT NULL,
	`cgst_paise` integer DEFAULT 0 NOT NULL,
	`sgst_paise` integer DEFAULT 0 NOT NULL,
	`igst_paise` integer DEFAULT 0 NOT NULL,
	`total_paise` integer NOT NULL,
	`balance_paise` integer NOT NULL,
	`issued_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `invoices_tenant_status_idx` ON `invoices` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`method` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`received_by` text NOT NULL,
	`received_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`state` text DEFAULT 'Maharashtra' NOT NULL,
	`postal_code` text DEFAULT '' NOT NULL,
	`gstin` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`default_gst_bps` integer DEFAULT 1200 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `properties_tenant_idx` ON `properties` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`property_id` text NOT NULL,
	`room_number` text NOT NULL,
	`floor` text NOT NULL,
	`room_type` text NOT NULL,
	`base_rate_paise` integer NOT NULL,
	`status` text DEFAULT 'AVAILABLE' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_property_number_unique` ON `rooms` (`property_id`,`room_number`);--> statement-breakpoint
CREATE INDEX `rooms_tenant_status_idx` ON `rooms` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`property_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_seen_at` text,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_tenant_idx` ON `users` (`tenant_id`);
