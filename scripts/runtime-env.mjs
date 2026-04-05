import { buildRuntimeEnvironment } from "../packages/config/dist/index.js"

export function getHydratedRuntimeEnvironment(env = process.env) {
  return {
    ...env,
    ...buildRuntimeEnvironment(env),
  }
}

export function applyHydratedRuntimeEnvironment(env = process.env) {
  const hydratedEnv = getHydratedRuntimeEnvironment(env)

  for (const [key, value] of Object.entries(hydratedEnv)) {
    if (typeof value === "string") {
      process.env[key] = value
    }
  }

  return hydratedEnv
}
