import { config } from "dotenv"
import { defineConfig } from "prisma/config"

// Load .env.local (where our DATABASE_URL lives)
config({ path: ".env.local" })

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
})
