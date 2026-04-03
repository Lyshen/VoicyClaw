import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"

const databaseFile =
  process.env.VOICYCLAW_SQLITE_FILE?.trim() ||
  resolve(process.cwd(), ".data", "voicyclaw.sqlite")

mkdirSync(dirname(databaseFile), { recursive: true })

export const db = new DatabaseSync(databaseFile)

export function getDatabaseFile() {
  return databaseFile
}
