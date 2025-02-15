import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoles = ["recruiter", "manager"] as const;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: userRoles }).notNull(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements").notNull(),
  managerId: integer("manager_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stages = [
  "Submitted",
  "First Round",
  "Second Round",
  "Third Round",
  "Selected",
  "Rejected",
] as const;

export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  recruiterId: integer("recruiter_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  resumeUrl: text("resume_url").notNull(),
  stage: text("stage", { enum: stages }).notNull().default("Submitted"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, managerId: true, createdAt: true });
export const insertCandidateSchema = createInsertSchema(candidates).omit({ 
  id: true, 
  recruiterId: true,
  createdAt: true 
});

export type Role = typeof userRoles[number];
export type Stage = typeof stages[number];
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Candidate = typeof candidates.$inferSelect & {
  recruiterUsername?: string;
};
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;