import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as XLSX from 'xlsx';
import { insertJobSchema, insertCandidateSchema, stages } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes and middleware
  setupAuth(app);

  // Jobs routes - only managers can create jobs
  app.get("/api/jobs", async (_req, res) => {
    const jobs = await storage.getJobs();
    res.json(jobs);
  });

  app.post("/api/jobs", isAuthenticated(["manager"]), async (req, res) => {
    const parsed = insertJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid job data" });
    }

    const job = await storage.createJob(parsed.data, req.user.id);
    res.json(job);
  });

  // Candidates routes - only recruiters can add candidates
  app.get("/api/jobs/:jobId/candidates", async (req, res) => {
    const jobId = parseInt(req.params.jobId);
    const candidates = await storage.getCandidates(jobId);
    res.json(candidates);
  });

  app.post("/api/candidates", isAuthenticated(["recruiter"]), async (req, res) => {
    const parsed = insertCandidateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid candidate data" });
    }

    // Check if email already exists for this job
    const emailExists = await storage.checkCandidateEmail(
      parsed.data.jobId,
      parsed.data.email
    );

    if (emailExists) {
      return res.status(400).json({ 
        error: "A candidate with this email has already been submitted for this job" 
      });
    }

    const candidate = await storage.createCandidate(parsed.data, req.user.id);
    res.json(candidate);
  });

  app.patch("/api/candidates/:id/stage", isAuthenticated(), async (req, res) => {
    const id = parseInt(req.params.id);
    const stage = req.body.stage;

    if (!stages.includes(stage)) {
      return res.status(400).json({ error: "Invalid stage" });
    }

    const candidate = await storage.updateCandidateStage(id, stage);
    res.json(candidate);
  });

  app.get("/api/jobs/:jobId/export", isAuthenticated(), async (req, res) => {
    const jobId = parseInt(req.params.jobId);
    const candidates = await storage.getCandidates(jobId);
    const job = await storage.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(candidates);
    XLSX.utils.book_append_sheet(wb, ws, "Candidates");

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=candidates-${jobId}.xlsx`);

    const buffer = XLSX.write(wb, { type: "buffer" });
    res.send(buffer);
  });

  app.post("/api/reset", isAuthenticated(["manager"]), async (_req, res) => {
    storage.clear();
    res.json({ message: "All data has been cleared" });
  });

  const httpServer = createServer(app);
  return httpServer;
}