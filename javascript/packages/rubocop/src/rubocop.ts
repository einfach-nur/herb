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
  severity: string
  copName: string
  message: string
  location: Location
  correctable: boolean
  corrections: RubocopCorrection[]
}

type RubocopResponse = {
  files: {
    offenses: RubocopOffense[]
  }[]
}

export class Rubocop {
  static ignoredCops = [
    "Style/FrozenStringLiteralComment",
    "Lint/Void",
    "Layout/IndentationWidth",
    "Layout/ArgumentAlignment",
  ]

  static offenses(node: Node): RubocopOffense[] {
    const visitor = new ExtractRubyVisitor()
    visitor.visit(node)
    if (!visitor.source) {
      return []
    }

    const rubocopOptions = env.HERB_LINTER_ERB_RUBOCOP_ADDITIONAL_OPTIONS || ""

    // TODO: `|| true`???
    let stdout = execSync(
      `bundle exec rubocop --stdin stdin --require ${jsonCorrectorFormatterPath} --format JSONCorrectorFormatter --except ${this.ignoredCops.join(",")} ${rubocopOptions} || true`,
      { input: visitor.source },
    )
    const rubocopResponse: RubocopResponse = JSON.parse(stdout.toString())

    for (const offense of rubocopResponse.files[0].offenses) {
      offense.location = new Location(
        this.translatePosition(visitor.mapping, offense.location.start),
        this.translatePosition(visitor.mapping, offense.location.end),
      )
      if (offense.correctable) {
        for (const correction of offense.corrections) {
          correction.location = new Location(
            this.translatePosition(visitor.mapping, correction.location.start),
            this.translatePosition(visitor.mapping, correction.location.end),
          )
        }
      }
    }

    return rubocopResponse.files[0].offenses
  }

  static corrections(node: Node): RubocopCorrection[] {
    return this.offenses(node).flatMap((offense) => offense.corrections)
  }

  private static translatePosition(
    mapping: { ruby: Position; erb: Position }[],
    rubyPosition: Position,
  ): Position {
    let relevantMapping

    for (let i = 0; i < mapping.length; i++) {
      if (
        mapping[i].ruby.line > rubyPosition.line ||
        (mapping[i].ruby.line === rubyPosition.line &&
          mapping[i].ruby.column > rubyPosition.column)
      ) {
        relevantMapping = mapping[i - 1]
        break
      }
    }

    if (!relevantMapping) {
      relevantMapping = mapping[mapping.length - 1]
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
  source: string
  mapping: { ruby: Position; erb: Position }[]

  constructor() {
    super()
    this.source = ""
    this.mapping = []
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
    if (!node.content) {
      this.visitChildNodes(node)
      return
    }

    let content = node.content.value.trimStart()
    const startTrimLength = node.content.value.length - content.length
    content = content.trimEnd()

    let erbPosition = new Position(
      node.content.location.start.line,
      node.content.location.start.column + startTrimLength,
    )

    this.mapping.push({ ruby: this.sourcePosition(), erb: erbPosition })
    this.source += content + "\n"

    this.visitChildNodes(node)
  }

  private sourcePosition(): Position {
    const lines = this.source.split("\n")
    const line = lines.length
    const column = lines[lines.length - 1].length

    return new Position(line, column)
  }
}
