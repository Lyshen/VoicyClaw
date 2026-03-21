import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    class FakeSpeechSynthesisUtterance {
      lang = ""
      onstart: null | (() => void) = null
      onend: null | (() => void) = null
      onerror: null | ((event: { error: string }) => void) = null

      constructor(readonly text: string) {}
    }

    const speechSynthesis = {
      speak(utterance: FakeSpeechSynthesisUtterance) {
        globalThis.setTimeout(() => {
          utterance.onstart?.()
          utterance.onend?.()
        }, 0)
      },
      cancel() {},
      getVoices() {
        return []
      }
    }

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: speechSynthesis
    })
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: FakeSpeechSynthesisUtterance
    })
  })
})

test("streams the mock bot reply from the channel view", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByText("websocket connected")).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/1 bot online/)).toBeVisible({ timeout: 60_000 })

  await page.getByPlaceholder(/Speak or type here/i).fill("hello")
  await page.getByRole("button", { name: "Send text" }).click()

  await expect(page.getByText(/demo-clawbot preview/i)).toBeVisible({ timeout: 60_000 })
  await expect(
    page.getByText(/Hello from Studio Claw\. I am running locally through the OpenClaw websocket channel/i)
  ).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/bot stream complete/i)).toBeVisible({ timeout: 60_000 })
})

test("persists server provider settings back into the channel runtime", async ({ page }) => {
  await page.goto("/settings")

  await page.getByRole("button").filter({ hasText: "Demo Server ASR" }).click()
  await page.getByRole("button").filter({ hasText: "Demo Server TTS" }).click()

  await expect(page.getByText("ASR Server provider")).toBeVisible()
  await expect(page.getByText("TTS Server provider")).toBeVisible()

  await page.goto("/")

  await expect(page.getByText("websocket connected")).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/ASR: Demo Server ASR/)).toBeVisible()
  await expect(page.getByText(/TTS: Demo Server TTS/)).toBeVisible()

  await page.getByPlaceholder(/Speak or type here/i).fill("design prototype")
  await page.getByRole("button", { name: "Send text" }).click()

  await expect(page.getByText(/This prototype proves the README architecture/i)).toBeVisible({
    timeout: 60_000
  })
})
