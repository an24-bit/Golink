// =====================================
//  GoLink — Main Server (Stage 1: Map Restore)
//  Version 3.3a – Static Frontend Only
//  Author: Ali
// =====================================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// --------------------------------------------------
// Setup
// --------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// --------------------------------------------------
// Middleware
// --------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// --------------------------------------------------
// Static Files
// --------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

// --------------------------------------------------
// Health Check
// --------------------------------------------------
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "GoLink",
    version: "3.3a",
    environment: process.env.NODE_ENV || "development",
  });
});

// --------------------------------------------------
// Catch-All Route (SPA Fallback)
// --------------------------------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --------------------------------------------------
// Start Server
// --------------------------------------------------
app.listen(PORT, () => {
  console.log(`🛰️  GoLink v3.3a (Map Restore) is live on port ${PORT}`);
});
