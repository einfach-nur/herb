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
} from "./nodes.js"
import { Visitor } from "./visitor.js"
import { Position } from "./position.js"
import { Location } from "./location.js"

import { jsonCorrectorFormatterPath } from "./paths.js"
import { env } from "node:process"
import { execSync } from "child_process"

export type RubocopCorrection = {
    location: Location
    replacement: string
}

export type RubocopOffense = {
    location: Location
    message: string
    severity: string
    corrections: RubocopCorrection[]
}

export class Rubocop {
    static ignored_cops = [
        "Style/FrozenStringLiteralComment",
        "Lint/Void",
        "Layout/IndentationWidth",
    ]

    private static translate_position(
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

        const line_offset = relevantMapping.erb.line - relevantMapping.ruby.line
        const column_offset =
            rubyPosition.line == relevantMapping.ruby.line
                ? relevantMapping.erb.column - relevantMapping.ruby.column
                : 0

        return new Position(
            rubyPosition.line + line_offset,
            rubyPosition.column + column_offset,
        )
    }

    static offenses(node: Node): RubocopOffense[] {
        const visitor = new ExtractRubyVisitor()
        visitor.visit(node)
        if (!visitor.source) {
            return []
        }

        const rubocopOptions = env.HERB_LINTER_ERB_RUBOCOP_ADDITIONAL_OPTIONS || ""

        // TODO: `|| true`???
        let stdout = execSync(
            `bundle exec rubocop --stdin stdin --require ${jsonCorrectorFormatterPath} --format JSONCorrectorFormatter --except ${this.ignored_cops.join(",")} ${rubocopOptions} || true`,
            { input: visitor.source },
        )
        const json = JSON.parse(stdout.toString())

        let offenses: RubocopOffense[] = []

        for (const offenseJSON of json.files[0].offenses) {
            const offenseLocation = new Location(
                this.translate_position(
                    visitor.mapping,
                    new Position(
                        offenseJSON.location.start_line,
                        offenseJSON.location.start_column - 1,
                    ),
                ),
                this.translate_position(
                    visitor.mapping,
                    new Position(
                        offenseJSON.location.last_line,
                        offenseJSON.location.last_column,
                    ),
                ),
            )

            let corrections: RubocopCorrection[] = []

            for (const replacement of offenseJSON.corrector.replacements) {
                const rubyLocation = new Location(
                    new Position(
                        replacement.range.start.line,
                        replacement.range.start.column,
                    ),
                    new Position(
                        replacement.range.end.line,
                        replacement.range.end.column,
                    ),
                )

                const erbLocation = new Location(
                    this.translate_position(visitor.mapping, rubyLocation.start),
                    this.translate_position(visitor.mapping, rubyLocation.end),
                )

                corrections.push({
                    location: erbLocation,
                    replacement: replacement.string,
                })
            }
            offenses.push({
                location: offenseLocation,
                message: offenseJSON.message,
                severity: offenseJSON.severity,
                corrections: corrections,
            })
        }
        return offenses
    }

    static corrections(node: Node): RubocopCorrection[] {
        return this.offenses(node).flatMap((offense) => offense.corrections)
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
        this.extract_ruby(node)
    }
    visitERBEndNode(node: ERBEndNode): void {
        this.extract_ruby(node)
    }
    visitERBElseNode(node: ERBElseNode): void {
        this.extract_ruby(node)
    }
    visitERBIfNode(node: ERBIfNode): void {
        this.extract_ruby(node)
    }
    visitERBBlockNode(node: ERBBlockNode): void {
        this.extract_ruby(node)
    }
    visitERBWhenNode(node: ERBWhenNode): void {
        this.extract_ruby(node)
    }
    visitERBCaseNode(node: ERBCaseNode): void {
        this.extract_ruby(node)
    }
    visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
        this.extract_ruby(node)
    }
    visitERBWhileNode(node: ERBWhileNode): void {
        this.extract_ruby(node)
    }
    visitERBUntilNode(node: ERBUntilNode): void {
        this.extract_ruby(node)
    }
    visitERBForNode(node: ERBForNode): void {
        this.extract_ruby(node)
    }
    visitERBRescueNode(node: ERBRescueNode): void {
        this.extract_ruby(node)
    }
    visitERBEnsureNode(node: ERBEnsureNode): void {
        this.extract_ruby(node)
    }
    visitERBBeginNode(node: ERBBeginNode): void {
        this.extract_ruby(node)
    }
    visitERBUnlessNode(node: ERBUnlessNode): void {
        this.extract_ruby(node)
    }
    visitERBYieldNode(node: ERBYieldNode): void {
        this.extract_ruby(node)
    }
    visitERBInNode(node: ERBInNode): void {
        this.extract_ruby(node)
    }

    extract_ruby(node: ERBNode): void {
        if (!node.content) {
            this.visitChildNodes(node)
            return
        }

        let content = node.content.value.trimStart()
        const startTrimLength = node.content.value.length - content.length
        content = content.trimEnd()

        let erb_position = new Position(
            node.content.location.start.line,
            node.content.location.start.column + startTrimLength,
        )

        this.mapping.push({ ruby: this.source_position(), erb: erb_position })
        this.source += content + "\n"

        this.visitChildNodes(node)
    }

    source_position(): Position {
        const lines = this.source.split("\n")
        const line = lines.length
        const column = lines[lines.length - 1].length

        return new Position(line, column)
    }
}
