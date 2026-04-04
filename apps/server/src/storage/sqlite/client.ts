import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"

import { resolveStorageConfig } from "@voicyclaw/config"

const require = createRequire(import.meta.url)
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite")

const databaseFile =
  resolveStorageConfig().sqliteFile ||
  resolve(process.cwd(), ".data", "voicyclaw.sqlite")

mkdirSync(dirname(databaseFile), { recursive: true })

export const db = new DatabaseSync(databaseFile)

export function getDatabaseFile() {
  return databaseFile
}
