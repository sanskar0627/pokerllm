import { config } from "dotenv"
import { existsSync } from "fs"
import { defineConfig } from "prisma/config"

// In local dev, DATABASE_URL lives in .env.local.
// In production (Railway / Docker), it's injected as a real env var — no file needed.
if (existsSync(".env.local")) {
  config({ path: ".env.local" })
}

// During Docker build (prisma generate), DATABASE_URL isn't set — that's fine,
// generate only creates TypeScript types and doesn't connect to the DB.
// At runtime (prisma migrate deploy), the real URL from Railway env vars is used.
const databaseUrl =
  process.env["DATABASE_URL"] || "postgresql://placeholder:placeholder@localhost:5432/placeholder"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
})

