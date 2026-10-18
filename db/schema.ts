import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    goal: text("goal").notNull().default(""),
    status: text("status").notNull().default("active"),
    startDate: text("start_date"),
    targetDate: text("target_date"),
    color: text("color").notNull().default("blue"),
    importance: integer("importance").notNull().default(3),
    isFoundation: integer("is_foundation", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_projects_user_name").on(table.userId, table.name).where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const projectExperiments = sqliteTable(
  "project_experiments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    intensityScore: integer("intensity_score").notNull().default(3),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("todo"),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: text("deleted_at"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_project_experiments_user_project").on(table.userId, table.projectId, table.deletedAt, table.status, table.sortOrder),
  ],
);

export const studyRecords = sqliteTable(
  "study_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    studyDate: text("study_date").notNull(),
    subject: text("subject").notNull(),
    recordType: text("record_type").notNull().default("learning"),
    experimentId: integer("experiment_id").references(() => projectExperiments.id, { onDelete: "set null" }),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
    intensityScore: integer("intensity_score").notNull(),
    note: text("note").notNull().default(""),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_study_records_user_date").on(
      table.userId,
      table.studyDate,
      table.createdAt,
    ),
    index("idx_study_records_user_project").on(table.userId, table.projectId),
    uniqueIndex("idx_study_records_user_experiment").on(table.userId, table.experimentId),
  ],
);

export const pointRedemptions = sqliteTable(
  "point_redemptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    rewardName: text("reward_name").notNull(),
    points: integer("points").notNull(),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_point_redemptions_user_created").on(table.userId, table.createdAt)],
);

export const projectDependencies = sqliteTable(
  "project_dependencies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    fromProjectId: integer("from_project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    toProjectId: integer("to_project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_project_dependencies_edge").on(table.userId, table.fromProjectId, table.toProjectId),
    index("idx_project_dependencies_target").on(table.userId, table.toProjectId),
  ],
);
