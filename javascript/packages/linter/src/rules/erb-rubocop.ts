import { type ParseResult } from "@herb-tools/core"
import { Rubocop, RubocopSeverity } from "@herb-tools/rubocop"
import { ParserRule } from "../types.js"
import type { LintOffense, LintContext, LintSeverity } from "../types.js"

export class ERBRubocopRule extends ParserRule {
  rubocopToLintSeverity: Record<RubocopSeverity, LintSeverity> = {
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
      message: offense.message + (offense.correctable ? " [correctable]" : ""),
      // TODO: Stay with error severity for everything for now
      severity: "error",
      // severity: this.rubocopToLintSeverity[offense.severity],
      location: offense.location,
    }))
  }
}
