import { storage } from "./storage"

try {
  await storage.system.init()
  console.log(storage.system.describeTarget())
} finally {
  await storage.system.close()
}
