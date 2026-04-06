"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import {
  formatDateTimeInputValue,
  toIsoDateTimeOrNull,
} from "../lib/billing-format"

export function LogsFilterForm({
  initialStartAt,
  initialEndAt,
}: {
  initialStartAt: string | null
  initialEndAt: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [startValue, setStartValue] = useState(
    formatDateTimeInputValue(initialStartAt),
  )
  const [endValue, setEndValue] = useState(
    formatDateTimeInputValue(initialEndAt),
  )

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    startTransition(() => {
      const params = new URLSearchParams()
      const startAt = toIsoDateTimeOrNull(startValue)
      const endAt = toIsoDateTimeOrNull(endValue)

      if (startAt) {
        params.set("start", startAt)
      }
      if (endAt) {
        params.set("end", endAt)
      }

      router.push(params.size > 0 ? `/logs?${params.toString()}` : "/logs")
    })
  }

  function clearFilters() {
    setStartValue("")
    setEndValue("")
    startTransition(() => {
      router.push("/logs")
    })
  }

  return (
    <form
      onSubmit={applyFilters}
      className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-end"
    >
      <label className="space-y-2">
        <span className="text-sm font-medium text-zinc-700">Start time</span>
        <input
          type="datetime-local"
          value={startValue}
          onChange={(event) => setStartValue(event.target.value)}
          className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-amber-300"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-zinc-700">End time</span>
        <input
          type="datetime-local"
          value={endValue}
          onChange={(event) => setEndValue(event.target.value)}
          className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-amber-300"
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="h-11 rounded-full bg-amber-500 px-4 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-default disabled:opacity-60"
      >
        {isPending ? "Applying..." : "Apply"}
      </button>

      <button
        type="button"
        disabled={isPending && !startValue && !endValue}
        onClick={clearFilters}
        className="h-11 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:border-amber-300 hover:text-amber-700 disabled:cursor-default disabled:opacity-60"
      >
        Clear
      </button>
    </form>
  )
}
