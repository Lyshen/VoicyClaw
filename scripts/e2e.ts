import { runRepoCommand } from "./runtime-shared"

const env = {
  ...process.env,
  PLAYWRIGHT_BASE_URL: "http://127.0.0.1:34100",
  NEXT_PUBLIC_VOICYCLAW_AUTH_MODE: "local",
  NEXT_PUBLIC_VOICYCLAW_SERVER_URL: "http://127.0.0.1:34101",
  VOICYCLAW_SERVER_URL: "http://127.0.0.1:34101",
  VOICYCLAW_WEB_PORT: "34100",
  VOICYCLAW_SERVER_PORT: "34101",
}

await runRepoCommand(["build"], env)
await runRepoCommand(["exec", "playwright", "test"], env)
