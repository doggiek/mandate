"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  AGENTS,
  ALL_PROTOCOLS,
  useMandateStore,
} from "@/lib/mandate-store"
import { NETWORK } from "@/lib/chain-config"
import { formatUsd } from "@/lib/format"
import { Check } from "lucide-react"

const DURATIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
]

export function CreateMandateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { createMandate } = useMandateStore()

  const [label, setLabel] = React.useState("")
  const [agentId, setAgentId] = React.useState(AGENTS[0].id)
  const [budget, setBudget] = React.useState(100000)
  const [txLimit, setTxLimit] = React.useState(10000)
  const [approval, setApproval] = React.useState(50000)
  const [protocols, setProtocols] = React.useState<string[]>(["DeepBook"])
  const [duration, setDuration] = React.useState(30)
  const [network, setNetwork] = React.useState<"mainnet" | "testnet">(
    NETWORK as "mainnet" | "testnet"
  )

  function reset() {
    setLabel("")
    setAgentId(AGENTS[0].id)
    setBudget(100000)
    setTxLimit(10000)
    setApproval(50000)
    setProtocols(["DeepBook"])
    setDuration(30)
    setNetwork("mainnet")
  }

  function toggleProtocol(p: string) {
    setProtocols((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const valid = label.trim().length > 0 && protocols.length > 0

  function handleSubmit() {
    if (!valid) return
    const m = createMandate({
      label: label.trim(),
      agentId,
      budget,
      txLimit,
      approvalThreshold: approval,
      protocols: protocols as never,
      durationDays: duration,
      network,
    })
    toast.success("Mandate created", {
      description: `${m.label} · ${formatUsd(budget, { compact: true })} ceiling`,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="p-4">
          <DialogTitle>Create Mandate</DialogTitle>
          <DialogDescription>
            Grant an agent scoped, revocable spending authority on Sui.
          </DialogDescription>
        </DialogHeader>

        <div className="border-t border-border p-4">
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="mandate-label">Label</FieldLabel>
              <Input
                id="mandate-label"
                placeholder="e.g. DeepBook market-making allowance"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="mandate-agent">Agent</FieldLabel>
              <Select
                value={agentId}
                onValueChange={(value) => value && setAgentId(value)}
              >
                <SelectTrigger id="mandate-agent" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {AGENTS.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                The autonomous agent that will operate under this mandate.
              </FieldDescription>
            </Field>

            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel>Budget ceiling</FieldLabel>
                <span className="text-sm font-medium tabular-nums">
                  {formatUsd(budget)}
                </span>
              </div>
              <Slider
                value={[budget]}
                min={10000}
                max={1000000}
                step={10000}
                onValueChange={(v) =>
                  setBudget(Array.isArray(v) ? v[0] : (v as number))
                }
              />
              <FieldDescription>
                Maximum total capital the agent can deploy over the mandate&apos;s life.
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="tx-limit">Per-transaction limit</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>$</InputGroupAddon>
                  <InputGroupInput
                    id="tx-limit"
                    type="number"
                    value={txLimit}
                    onChange={(e) => setTxLimit(Number(e.target.value))}
                  />
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="approval">Approval threshold</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>$</InputGroupAddon>
                  <InputGroupInput
                    id="approval"
                    type="number"
                    value={approval}
                    onChange={(e) => setApproval(Number(e.target.value))}
                  />
                </InputGroup>
              </Field>
            </div>

            <Field>
              <FieldLabel>Protocol restrictions</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {ALL_PROTOCOLS.map((p) => {
                  const selected = protocols.includes(p)
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleProtocol(p)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
                        selected
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-transparent text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {selected && <Check className="size-3.5" />}
                      {p}
                    </button>
                  )
                })}
              </div>
              <FieldDescription>
                The agent can only interact with the protocols you allow.
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel>Expiration</FieldLabel>
                <Select
                  value={String(duration)}
                  onValueChange={(v) => setDuration(Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {DURATIONS.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Network</FieldLabel>
                <Select
                  value={network}
                  onValueChange={(v) => setNetwork(v as "mainnet" | "testnet")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="mainnet">Mainnet</SelectItem>
                      <SelectItem value="testnet">Testnet</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
        </div>

        <DialogFooter showCloseButton>
          <Button
            onClick={handleSubmit}
            disabled={!valid}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Create Mandate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
