import { runServiceGroup } from "./runtime-shared"

await runServiceGroup(["server", "web", "mock-bot"], "start")
