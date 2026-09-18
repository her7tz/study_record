import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const studyRecords = sqliteTable(
  "study_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    studyDate: text("study_date").notNull(),
    subject: text("subject").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_study_records_user_date").on(
      table.userId,
      table.studyDate,
      table.createdAt,
    ),
  ],
);
