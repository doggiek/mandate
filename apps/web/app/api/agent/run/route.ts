import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type AgentRunStatus = "SUCCESS" | "FAILED"

type AgentRunResult = {
  digest: string
  status: AgentRunStatus
  activityEventFound: boolean
  deepBookPoolMutationFound: boolean
  balanceChangeSui: string
  error?: string
}

const EMPTY_RESULT: AgentRunResult = {
  digest: "",
  status: "FAILED",
  activityEventFound: false,
  deepBookPoolMutationFound: false,
  balanceChangeSui: "0 SUI",
}

function readSection(output: string, label: string) {
  const match = output.match(new RegExp(`${label}:\\s*\\n([^\\n]*)`))
  return match?.[1]?.trim() ?? ""
}

function parseAgentOutput(output: string, error?: string): AgentRunResult {
  const status = readSection(output, "Status")
  return {
    digest: readSection(output, "Digest"),
    status: status === "SUCCESS" ? "SUCCESS" : "FAILED",
    activityEventFound: readSection(output, "Activity Event") === "FOUND",
    deepBookPoolMutationFound:
      readSection(output, "DeepBook Pool Mutation") === "FOUND",
    balanceChangeSui: readSection(output, "Balance Change") || "0 SUI",
    ...(error ? { error } : {}),
  }
}

export async function POST() {
  const repoRoot = path.resolve(process.cwd(), "../..")

  try {
    const { stdout, stderr } = await execFileAsync(
      "npm",
      ["run", "agent:swap", "--silent"],
      {
        cwd: repoRoot,
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
      }
    )

    const result = parseAgentOutput(stdout, stderr.trim() || undefined)
    return Response.json(result, { status: result.status === "SUCCESS" ? 200 : 500 })
  } catch (caught) {
    const error = caught as {
      stdout?: string
      stderr?: string
      message?: string
    }
    const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`
    const result = output.trim()
      ? parseAgentOutput(output, error.stderr?.trim() || error.message)
      : { ...EMPTY_RESULT, error: error.message ?? "Agent execution failed" }

    return Response.json(result, { status: 500 })
  }
}
