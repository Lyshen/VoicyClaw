import { describe, expect, it } from "vitest"

import { resolveStorageDriver } from "../apps/server/src/storage"

describe("storage driver selection", () => {
  it("defaults to sqlite when no mysql config is present", () => {
    expect(resolveStorageDriver({})).toBe("sqlite")
  })

  it("switches to mysql when a mysql url is present", () => {
    expect(
      resolveStorageDriver({
        VOICYCLAW_MYSQL_URL: "mysql://root:password@127.0.0.1:3306/voicyclaw",
      }),
    ).toBe("mysql")
  })

  it("lets an explicit storage driver override the heuristic", () => {
    expect(
      resolveStorageDriver({
        VOICYCLAW_STORAGE_DRIVER: "sqlite",
        VOICYCLAW_MYSQL_URL: "mysql://root:password@127.0.0.1:3306/voicyclaw",
      }),
    ).toBe("sqlite")
  })
})
