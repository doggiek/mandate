import { notFound } from "next/navigation"

import { ConsoleShell, type ConsoleView } from "@/components/console-shell"

const VIEWS = new Set(["overview", "mandates", "activity", "orders"])

export default async function ConsoleViewPage({
  params,
}: {
  params: Promise<{ view: string }>
}) {
  const { view } = await params

  if (!VIEWS.has(view)) {
    notFound()
  }

  return <ConsoleShell initialView={view as ConsoleView} />
}
