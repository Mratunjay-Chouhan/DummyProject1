import { Job, InsertJob, Candidate, InsertCandidate, Stage, User, InsertUser } from "@shared/schema";
import { users, jobs, candidates } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import type { Store } from "express-session";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Jobs
  getJobs(): Promise<Job[]>;
  getJob(id: number): Promise<Job | undefined>;
  createJob(job: InsertJob, managerId: number): Promise<Job>;

  // Candidates
  getCandidates(jobId: number): Promise<Candidate[]>;
  getCandidate(id: number): Promise<Candidate | undefined>;
  createCandidate(candidate: InsertCandidate, recruiterId: number): Promise<Candidate>;
  updateCandidateStage(id: number, stage: Stage): Promise<Candidate>;
  checkCandidateEmail(jobId: number, email: string): Promise<boolean>;

  // Session store
  sessionStore: Store;
  clear(): void;
}

export class DatabaseStorage implements IStorage {
  sessionStore: Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async clear(): Promise<void> {
    await db.delete(candidates);
    await db.delete(jobs);
    await db.delete(users);
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getJobs(): Promise<Job[]> {
    return await db.select().from(jobs);
  }

  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async createJob(insertJob: InsertJob, managerId: number): Promise<Job> {
    const [job] = await db
      .insert(jobs)
      .values({ ...insertJob, managerId, createdAt: new Date() })
      .returning();
    return job;
  }

  async getCandidates(jobId: number): Promise<Candidate[]> {
    const results = await db
      .select({
        id: candidates.id,
        jobId: candidates.jobId,
        recruiterId: candidates.recruiterId,
        name: candidates.name,
        email: candidates.email,
        stage: candidates.stage,
        notes: candidates.notes,
        createdAt: candidates.createdAt,
        recruiterUsername: users.username,
      })
      .from(candidates)
      .where(eq(candidates.jobId, jobId))
      .leftJoin(users, eq(candidates.recruiterId, users.id))
      .orderBy(candidates.createdAt);

    return results.map(result => ({
      ...result,
      recruiterUsername: result.recruiterUsername || 'Unknown'
    }));
  }

  async getCandidate(id: number): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));
    return candidate;
  }

  async checkCandidateEmail(jobId: number, email: string): Promise<boolean> {
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(
        and(
          eq(candidates.jobId, jobId),
          eq(candidates.email, email.toLowerCase())
        )
      );
    return !!candidate;
  }

  async createCandidate(insertCandidate: InsertCandidate, recruiterId: number): Promise<Candidate> {
    const [candidate] = await db
      .insert(candidates)
      .values({
        ...insertCandidate,
        recruiterId,
        stage: insertCandidate.stage || "Submitted",
        notes: insertCandidate.notes || null,
        createdAt: new Date(),
      })
      .returning();
    return candidate;
  }

  async updateCandidateStage(id: number, stage: Stage): Promise<Candidate> {
    const [candidate] = await db
      .update(candidates)
      .set({ stage })
      .where(eq(candidates.id, id))
      .returning();
    return candidate;
  }
}

export const storage = new DatabaseStorage();