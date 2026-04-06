import { expect, type Page, test } from "@playwright/test"

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
      },
    }

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: speechSynthesis,
    })
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: FakeSpeechSynthesisUtterance,
    })
  })
})

async function openStudioConversation(page: Page) {
  await page.goto("/studio")

  const composer = page.getByPlaceholder(/Speak or type here/i)
  const checkConnectionButton = page.getByRole("button", {
    name: /Check bot (online|connection)/i,
  })
  const continueVoicePathsButton = page.getByRole("button", {
    name: /Continue to voice paths/i,
  })
  const continueTalkButton = page.getByRole("button", {
    name: /Continue to talk/i,
  })
  const openTalkButton = page.getByRole("button", { name: /Open talk/i })
  const backToSetupButton = page.getByRole("button", { name: /Back to setup/i })

  await expect
    .poll(
      async () => {
        if (await composer.isVisible().catch(() => false)) {
          return "ready"
        }

        if (await continueTalkButton.isVisible().catch(() => false)) {
          await continueTalkButton.click()
          return "advancing"
        }

        if (await openTalkButton.isVisible().catch(() => false)) {
          await openTalkButton.click()
          return "advancing"
        }

        if (await continueVoicePathsButton.isVisible().catch(() => false)) {
          await continueVoicePathsButton.click()
          return "advancing"
        }

        if (await backToSetupButton.isVisible().catch(() => false)) {
          await backToSetupButton.click()
          return "advancing"
        }

        if (await checkConnectionButton.isVisible().catch(() => false)) {
          await checkConnectionButton.click()
          return "checking"
        }

        return "waiting"
      },
      {
        timeout: 60_000,
        intervals: [250, 500, 1_000],
      },
    )
    .toBe("ready")
}

test("streams the mock bot reply from the channel view", async ({ page }) => {
  await openStudioConversation(page)

  await page.getByPlaceholder(/Speak or type here/i).fill("hello")
  await page.getByRole("button", { name: /Send (message|text)/i }).click()

  await expect(
    page.getByText(
      /Hello from Studio Claw\. I am running locally through the OpenClaw websocket channel/i,
    ),
  ).toBeVisible({ timeout: 60_000 })
})

test("persists server provider settings back into the channel runtime", async ({
  page,
}) => {
  await page.goto("/settings")

  await page.getByTestId("asr-provider-demo").click()
  await page.getByTestId("tts-provider-demo").click()

  await expect(page.getByText("ASR Server provider")).toBeVisible()
  await expect(page.getByText("TTS Server provider")).toBeVisible()

  const persistedSettings = await page.evaluate(() => {
    const storageKey = Object.keys(window.localStorage).find((key) =>
      key.startsWith("voicyclaw.studio.settings"),
    )
    if (!storageKey) {
      return null
    }

    const raw = window.localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : null
  })

  expect(persistedSettings).toMatchObject({
    asrProvider: "demo",
    ttsProvider: "demo",
  })

  await openStudioConversation(page)

  await page.getByPlaceholder(/Speak or type here/i).fill("design prototype")
  await page.getByRole("button", { name: /Send (message|text)/i }).click()

  await expect(
    page.getByText(/This prototype proves the README architecture/i),
  ).toBeVisible({
    timeout: 60_000,
  })
})
