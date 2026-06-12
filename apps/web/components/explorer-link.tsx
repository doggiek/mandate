import { ExternalLink } from "lucide-react"

import { cn } from "@/lib/utils"

export function transactionUrl(digest: string) {
  return `https://testnet.suivision.xyz/txblock/${digest}`
}

export function objectUrl(objectId: string) {
  return `https://testnet.suivision.xyz/object/${objectId}`
}

export function ExplorerLink({
  digest,
  objectId,
  label = "View on Suivision",
  className,
}: {
  digest?: string | null
  objectId?: string | null
  label?: string
  className?: string
}) {
  const href = digest ? transactionUrl(digest) : objectId ? objectUrl(objectId) : null
  if (!href) {
    return null
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={label}
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-primary/10 hover:text-primary",
        className
      )}
    >
      <ExternalLink className="size-3.5" />
    </a>
  )
}
