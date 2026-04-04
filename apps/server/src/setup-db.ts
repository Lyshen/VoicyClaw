import { storage } from "./storage"

await storage.system.init()

console.log(storage.system.describeTarget())
