import {
  ERBEndNode,
  ERBElseNode,
  ERBIfNode,
  ERBBlockNode,
  ERBWhenNode,
  ERBCaseNode,
  ERBCaseMatchNode,
  ERBWhileNode,
  ERBUntilNode,
  ERBForNode,
  ERBRescueNode,
  ERBEnsureNode,
  ERBBeginNode,
  ERBUnlessNode,
  ERBYieldNode,
  ERBInNode,
  ERBNode,
  Node,
  ERBContentNode,
} from "@herb-tools/core"
import { Visitor } from "@herb-tools/core"
import { Position } from "@herb-tools/core"
import { Location } from "@herb-tools/core"

import { jsonCorrectorFormatterPath } from "./paths.js"
import { env } from "node:process"
import { execSync } from "child_process"

export type RubocopCorrection = {
  string: string
  location: Location
}

export type RubocopOffense = {
  severity: RubocopSeverity
  copName: string
  message: string
  location: Location
  correctable: boolean
  corrections: RubocopCorrection[]
}

export type RubocopSeverity =
  | "info"
  | "refactor"
  | "convention"
  | "warning"
  | "error"
  | "fatal"

type RubocopResponse = {
  files: {
    offenses: RubocopOffense[]
  }[]
}

type PositionMapping = {
  erb: Position
  ruby: Position
}

type RubyAnalysis = {
  ruby: string
  mappings: PositionMapping[]
}

export class Rubocop {
  static applyCorrectionsToNode(
    node: ERBNode,
    corrections: RubocopCorrection[],
  ): string {
    if (!node.content) {
      return ""
    }

    const content = node.content
    const nodeSource = content.value
    const contentStart = node.content.location.start

    const relevantCorrections = corrections.filter((correction) => {
      const startInContent =
        correction.location.start.line > contentStart.line ||
        (correction.location.start.line === contentStart.line &&
          correction.location.start.column >= contentStart.column)

      const endInContent =
        correction.location.end.line < content.location.end.line ||
        (correction.location.end.line === content.location.end.line &&
          correction.location.end.column <= content.location.end.column)

      return startInContent && endInContent
    })

    const translated = relevantCorrections
      .map((correction) => ({
        ...correction,
        startIndex: this.getRelativeIndexFromPosition(
          nodeSource,
          contentStart,
          correction.location.start,
        ),
        endIndex: this.getRelativeIndexFromPosition(
          nodeSource,
          contentStart,
          correction.location.end,
        ),
      }))
      .sort((a, b) => a.startIndex - b.startIndex)

    let updated = nodeSource
    for (let i = translated.length - 1; i >= 0; i--) {
      updated =
        updated.slice(0, translated[i].startIndex) +
        translated[i].string +
        updated.slice(translated[i].endIndex)
    }

    return updated
  }

  static offenses(node: Node): RubocopOffense[] {
    let analysis = this.extractRuby(node)
    if (!analysis.ruby) {
      return []
    }

    let response = this.callRubocop(analysis.ruby)

    for (const offense of response.files[0].offenses) {
      offense.location = new Location(
        this.translatePosition(analysis.mappings, offense.location.start),
        this.translatePosition(analysis.mappings, offense.location.end),
      )
      if (offense.correctable) {
        for (const correction of offense.corrections) {
          correction.location = new Location(
            this.translatePosition(
              analysis.mappings,
              correction.location.start,
            ),
            this.translatePosition(analysis.mappings, correction.location.end),
          )
        }
      }
    }

    return response.files[0].offenses
  }

  static corrections(node: Node): RubocopCorrection[] {
    return this.offenses(node).flatMap((offense) => offense.corrections)
  }

  private static getRelativeIndexFromPosition(
    source: string,
    base: Position,
    position: Position,
  ): number {
    const lines = source.split("\n")
    const lineDelta = position.line - base.line

    if (lineDelta < 0) {
      return 0
    }

    if (lineDelta > lines.length - 1) {
      return source.length
    }

    if (lineDelta === 0) {
      // same document line as content start -> just shift by base.column
      const index = position.column - base.column // end column is exclusive already
      return Math.max(0, Math.min(source.length, index))
    }

    // lineDelta >= 1:
    // take the ENTIRE first content line (no subtraction by base.column!)
    // plus its newline, then add full middle lines (+ newline each),
    // then add column on the target line.
    let index = lines[0].length + 1
    for (let i = 1; i < lineDelta; i++) {
      index += lines[i].length + 1
    }
    index += position.column
    return index
  }

  private static DISABLED_COPS = [
    "Layout/ArgumentAlignment",
    "Layout/ArrayAlignment",
    "Layout/AssignmentIndentation",
    "Layout/ElseAlignment",
    "Layout/EmptyLineAfterGuardClause",
    "Layout/EndAlignment",
    "Layout/FirstArgumentIndentation",
    "Layout/FirstArrayElementIndentation",
    "Layout/FirstHashElementIndentation",
    "Layout/IndentationConsistency",
    "Layout/IndentationWidth",
    "Layout/MultilineMethodCallIndentation",
    "Lint/Void",
    "Rails/Presence",
    "Style/EmptyElse",
    "Style/IdenticalConditionalBranches",
    "Style/FrozenStringLiteralComment",
    "Style/SymbolProc",
  ]

  private static callRubocop(ruby: string): RubocopResponse {
    const rubocopOptions = env.HERB_LINTER_ERB_RUBOCOP_ADDITIONAL_OPTIONS || ""

    // TODO: `|| true`???
    let stdout = execSync(
      `bundle exec rubocop --stdin stdin --require ${jsonCorrectorFormatterPath} --format JSONCorrectorFormatter --except ${this.DISABLED_COPS.join(",")} ${rubocopOptions} || true`,
      { input: ruby },
    )
    return JSON.parse(stdout.toString())
  }

  private static extractRuby(node: Node): RubyAnalysis {
    const visitor = new ExtractRubyVisitor()
    visitor.visit(node)
    return {
      ruby: visitor.ruby,
      mappings: visitor.mappings,
    }
  }

  private static translatePosition(
    mappings: PositionMapping[],
    rubyPosition: Position,
  ): Position {
    let relevantMapping

    for (let i = 0; i < mappings.length; i++) {
      if (
        mappings[i].ruby.line > rubyPosition.line ||
        (mappings[i].ruby.line === rubyPosition.line &&
          mappings[i].ruby.column > rubyPosition.column)
      ) {
        relevantMapping = mappings[i - 1]
        break
      }
    }

    if (!relevantMapping) {
      relevantMapping = mappings[mappings.length - 1]
    }

    const lineOffset = relevantMapping.erb.line - relevantMapping.ruby.line
    const columnOffset =
      rubyPosition.line == relevantMapping.ruby.line
        ? relevantMapping.erb.column - relevantMapping.ruby.column
        : 0

    return new Position(
      rubyPosition.line + lineOffset,
      rubyPosition.column + columnOffset,
    )
  }
}

class ExtractRubyVisitor extends Visitor {
  ruby: string
  mappings: PositionMapping[]

  constructor() {
    super()
    this.ruby = ""
    this.mappings = []
  }

  visitERBContentNode(node: ERBContentNode): void {
    this.extractRuby(node)
  }
  visitERBEndNode(node: ERBEndNode): void {
    this.extractRuby(node)
  }
  visitERBElseNode(node: ERBElseNode): void {
    this.extractRuby(node)
  }
  visitERBIfNode(node: ERBIfNode): void {
    this.extractRuby(node)
  }
  visitERBBlockNode(node: ERBBlockNode): void {
    this.extractRuby(node)
  }
  visitERBWhenNode(node: ERBWhenNode): void {
    this.extractRuby(node)
  }
  visitERBCaseNode(node: ERBCaseNode): void {
    this.extractRuby(node)
  }
  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    this.extractRuby(node)
  }
  visitERBWhileNode(node: ERBWhileNode): void {
    this.extractRuby(node)
  }
  visitERBUntilNode(node: ERBUntilNode): void {
    this.extractRuby(node)
  }
  visitERBForNode(node: ERBForNode): void {
    this.extractRuby(node)
  }
  visitERBRescueNode(node: ERBRescueNode): void {
    this.extractRuby(node)
  }
  visitERBEnsureNode(node: ERBEnsureNode): void {
    this.extractRuby(node)
  }
  visitERBBeginNode(node: ERBBeginNode): void {
    this.extractRuby(node)
  }
  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.extractRuby(node)
  }
  visitERBYieldNode(node: ERBYieldNode): void {
    this.extractRuby(node)
  }
  visitERBInNode(node: ERBInNode): void {
    this.extractRuby(node)
  }

  extractRuby(node: ERBNode): void {
    // TODO: this feels hacky
    if (!node.content || node.tag_opening?.value == "<%#") {
      this.visitChildNodes(node)
      return
    }

    const leadingWhitespace = (node.content.value.match(/^\s*/) || [""])[0]

    const newlineCount = (leadingWhitespace.match(/\r?\n/g) || []).length
    const line = node.content.location.start.line + newlineCount

    let column = node.content.location.start.column + leadingWhitespace.length

    if (newlineCount > 0) {
      column =
        leadingWhitespace.length -
        1 -
        Math.max(
          leadingWhitespace.lastIndexOf("\n"),
          leadingWhitespace.lastIndexOf("\r"),
        )
    }

    const erbPosition = new Position(line, column)

    this.mappings.push({ ruby: this.sourcePosition(), erb: erbPosition })
    this.ruby += node.content.value.trim() + "\n"

    this.visitChildNodes(node)
  }

  private sourcePosition(): Position {
    const lines = this.ruby.split("\n")
    const line = lines.length
    const column = lines[lines.length - 1].length

    return new Position(line, column)
  }
}
