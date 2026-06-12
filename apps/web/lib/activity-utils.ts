import type { ActivityEvent } from "@/lib/mandate-data"

function activityTimeValue(event: ActivityEvent) {
  if (typeof event.timestampMs === "number" && Number.isFinite(event.timestampMs)) {
    return event.timestampMs
  }

  const timestamp = new Date(event.timestamp).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function sortActivitiesByTimeDesc(events: ActivityEvent[]) {
  return [...events].sort((a, b) => activityTimeValue(b) - activityTimeValue(a))
}
