import { runRepoCommand, runServiceGroup } from "./runtime-shared"

await runRepoCommand(["build:packages"])
await runRepoCommand(["db:generate"])
await runRepoCommand(["db:push"])
await runServiceGroup(["server", "web", "mock-bot"], "dev")
