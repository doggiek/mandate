import type { ActivityEvent } from "@/lib/mandate-data"

function activityTimeValue(event: ActivityEvent) {
  const timestamp = new Date(event.timestamp).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function sortActivitiesByTimeDesc(events: ActivityEvent[]) {
  return [...events].sort((a, b) => activityTimeValue(b) - activityTimeValue(a))
}
