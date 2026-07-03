import { config } from "dotenv"
import { existsSync } from "fs"
import { defineConfig } from "prisma/config"

// In local dev, DATABASE_URL lives in .env.local.
// In production (Railway / Docker), it's injected as a real env var — no file needed.
if (existsSync(".env.local")) {
  config({ path: ".env.local" })
}

const databaseUrl = process.env["DATABASE_URL"]
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. " +
    "Local: add it to .env.local. " +
    "Railway: add it in the Variables tab."
  )
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
})
