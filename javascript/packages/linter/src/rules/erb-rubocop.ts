import { type ParseResult } from "@herb-tools/core"
import { Rubocop } from "@herb-tools/rubocop"
import { ParserRule } from "../types.js"
import type { LintOffense, LintContext, LintSeverity } from "../types.js"

export class ERBRubocopRule extends ParserRule {
  rubocopToLspSeverity: Record<string, LintSeverity> = {
    info: "hint",
    refactor: "info",
    convention: "info",
    warning: "warning",
    error: "error",
    fatal: "error",
  }

  name = "erb-rubocop"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    return Rubocop.offenses(result.value).map((offense) => ({
      rule: this.name,
      code: this.name,
      source: "Herb Linter",
      message: offense.message,
      severity: this.rubocopToLspSeverity[offense.severity],
      location: offense.location,
    }))
  }
}
