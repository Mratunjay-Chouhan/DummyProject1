var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  candidates: () => candidates,
  insertCandidateSchema: () => insertCandidateSchema,
  insertJobSchema: () => insertJobSchema,
  insertUserSchema: () => insertUserSchema,
  jobs: () => jobs,
  stages: () => stages,
  userRoles: () => userRoles,
  users: () => users
});
import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var userRoles = ["recruiter", "manager"];
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: userRoles }).notNull()
});
var jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements").notNull(),
  managerId: integer("manager_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var stages = [
  "Submitted",
  "First Round",
  "Second Round",
  "Third Round",
  "Selected",
  "Rejected"
];
var candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  recruiterId: integer("recruiter_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  resumeUrl: text("resume_url").notNull(),
  stage: text("stage", { enum: stages }).notNull().default("Submitted"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).omit({ id: true });
var insertJobSchema = createInsertSchema(jobs).omit({ id: true, managerId: true, createdAt: true });
var insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
  recruiterId: true,
  createdAt: true
});

// server/storage.ts
import { eq, and } from "drizzle-orm";

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import connectPg from "connect-pg-simple";
import session from "express-session";
var PostgresSessionStore = connectPg(session);
var DatabaseStorage = class {
  sessionStore;
  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }
  async clear() {
    await db.delete(candidates);
    await db.delete(jobs);
    await db.delete(users);
  }
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async getJobs() {
    return await db.select().from(jobs);
  }
  async getJob(id) {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }
  async createJob(insertJob, managerId) {
    const [job] = await db.insert(jobs).values({ ...insertJob, managerId, createdAt: /* @__PURE__ */ new Date() }).returning();
    return job;
  }
  async getCandidates(jobId) {
    const results = await db.select({
      id: candidates.id,
      jobId: candidates.jobId,
      recruiterId: candidates.recruiterId,
      name: candidates.name,
      email: candidates.email,
      stage: candidates.stage,
      notes: candidates.notes,
      createdAt: candidates.createdAt,
      recruiterUsername: users.username
    }).from(candidates).where(eq(candidates.jobId, jobId)).leftJoin(users, eq(candidates.recruiterId, users.id)).orderBy(candidates.createdAt);
    return results.map((result) => ({
      ...result,
      recruiterUsername: result.recruiterUsername || "Unknown"
    }));
  }
  async getCandidate(id) {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));
    return candidate;
  }
  async checkCandidateEmail(jobId, email) {
    const [candidate] = await db.select().from(candidates).where(
      and(
        eq(candidates.jobId, jobId),
        eq(candidates.email, email.toLowerCase())
      )
    );
    return !!candidate;
  }
  async createCandidate(insertCandidate, recruiterId) {
    const [candidate] = await db.insert(candidates).values({
      ...insertCandidate,
      recruiterId,
      stage: insertCandidate.stage || "Submitted",
      notes: insertCandidate.notes || null,
      createdAt: /* @__PURE__ */ new Date()
    }).returning();
    return candidate;
  }
  async updateCandidateStage(id, stage) {
    const [candidate] = await db.update(candidates).set({ stage }).where(eq(candidates.id, id)).returning();
    return candidate;
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
import * as XLSX from "xlsx";

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session2 from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
var scryptAsync = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
function isAuthenticated(roles) {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (roles && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    next();
  };
}
function setupAuth(app2) {
  app2.use(
    session2({
      secret: "your-secret-key",
      // In production, use environment variable
      resave: false,
      saveUninitialized: false,
      store: storage.sessionStore,
      cookie: { secure: process.env.NODE_ENV === "production" }
    })
  );
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !await comparePasswords(password, user.password)) {
          return done(null, false);
        }
        const { password: _, ...safeUser } = user;
        return done(null, safeUser);
      } catch (err) {
        return done(err);
      }
    })
  );
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      const { password: _, ...safeUser } = user;
      done(null, safeUser);
    } catch (err) {
      done(err);
    }
  });
  app2.post("/api/register", async (req, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid user data",
          errors: parsed.error.errors
        });
      }
      const existing = await storage.getUserByUsername(parsed.data.username);
      if (existing) {
        return res.status(400).json({
          message: "Username already taken",
          field: "username"
        });
      }
      const hashedPassword = await hashPassword(parsed.data.password);
      const user = await storage.createUser({
        ...parsed.data,
        password: hashedPassword
      });
      const { password: _, ...safeUser } = user;
      req.login(safeUser, (err) => {
        if (err) throw err;
        res.status(201).json(safeUser);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Server error occurred during registration" });
    }
  });
  app2.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.login(user, (err2) => {
        if (err2) return next(err2);
        res.json(user);
      });
    })(req, res, next);
  });
  app2.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.sendStatus(200);
    });
  });
  app2.get("/api/me", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });
}

// server/routes.ts
async function registerRoutes(app2) {
  setupAuth(app2);
  app2.get("/api/jobs", async (_req, res) => {
    const jobs2 = await storage.getJobs();
    res.json(jobs2);
  });
  app2.post("/api/jobs", isAuthenticated(["manager"]), async (req, res) => {
    const parsed = insertJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid job data" });
    }
    const job = await storage.createJob(parsed.data, req.user.id);
    res.json(job);
  });
  app2.get("/api/jobs/:jobId/candidates", async (req, res) => {
    const jobId = parseInt(req.params.jobId);
    const candidates2 = await storage.getCandidates(jobId);
    res.json(candidates2);
  });
  app2.post("/api/candidates", isAuthenticated(["recruiter"]), async (req, res) => {
    const parsed = insertCandidateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid candidate data" });
    }
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
  app2.patch("/api/candidates/:id/stage", isAuthenticated(), async (req, res) => {
    const id = parseInt(req.params.id);
    const stage = req.body.stage;
    if (!stages.includes(stage)) {
      return res.status(400).json({ error: "Invalid stage" });
    }
    const candidate = await storage.updateCandidateStage(id, stage);
    res.json(candidate);
  });
  app2.get("/api/jobs/:jobId/export", isAuthenticated(), async (req, res) => {
    const jobId = parseInt(req.params.jobId);
    const candidates2 = await storage.getCandidates(jobId);
    const job = await storage.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    const wb = XLSX.utils.book_new();
    const ws2 = XLSX.utils.json_to_sheet(candidates2);
    XLSX.utils.book_append_sheet(wb, ws2, "Candidates");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=candidates-${jobId}.xlsx`);
    const buffer = XLSX.write(wb, { type: "buffer" });
    res.send(buffer);
  });
  app2.post("/api/reset", isAuthenticated(["manager"]), async (_req, res) => {
    storage.clear();
    res.json({ message: "All data has been cleared" });
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [react(), runtimeErrorOverlay(), themePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    const env = process.env.NODE_ENV || "development";
    let logLine = `${env} - ${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
    if (path3.startsWith("/api")) {
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const PORT = 5e3;
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
})();
