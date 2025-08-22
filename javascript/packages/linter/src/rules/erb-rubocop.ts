import { Visitor, type ParseResult, type ERBContentNode, ERBEndNode, ERBElseNode, ERBIfNode, ERBBlockNode, ERBWhenNode, ERBCaseNode, ERBCaseMatchNode, ERBWhileNode, ERBUntilNode, ERBForNode, ERBRescueNode, ERBEnsureNode, ERBBeginNode, ERBUnlessNode, ERBYieldNode, ERBInNode, ERBNode, Position, Location } from "@herb-tools/core"
import { execSync } from "child_process"
import { ParserRule } from "../types.js"
import * as path from "path";
import type { LintOffense, LintContext, LintSeverity } from "../types.js"


class ExtractRubyVisitor extends Visitor {
    source: string
    mapping: { ruby: Position; erb: Position }[]

    constructor() {
        super();
        this.source = "";
        this.mapping = [];
    }

    visitERBContentNode(node: ERBContentNode): void { this.extract_ruby(node) }
    visitERBEndNode(node: ERBEndNode): void { this.extract_ruby(node) }
    visitERBElseNode(node: ERBElseNode): void { this.extract_ruby(node) }
    visitERBIfNode(node: ERBIfNode): void { this.extract_ruby(node) }
    visitERBBlockNode(node: ERBBlockNode): void { this.extract_ruby(node) }
    visitERBWhenNode(node: ERBWhenNode): void { this.extract_ruby(node) }
    visitERBCaseNode(node: ERBCaseNode): void { this.extract_ruby(node) }
    visitERBCaseMatchNode(node: ERBCaseMatchNode): void { this.extract_ruby(node) }
    visitERBWhileNode(node: ERBWhileNode): void { this.extract_ruby(node) }
    visitERBUntilNode(node: ERBUntilNode): void { this.extract_ruby(node) }
    visitERBForNode(node: ERBForNode): void { this.extract_ruby(node) }
    visitERBRescueNode(node: ERBRescueNode): void { this.extract_ruby(node) }
    visitERBEnsureNode(node: ERBEnsureNode): void { this.extract_ruby(node) }
    visitERBBeginNode(node: ERBBeginNode): void { this.extract_ruby(node) }
    visitERBUnlessNode(node: ERBUnlessNode): void { this.extract_ruby(node) }
    visitERBYieldNode(node: ERBYieldNode): void { this.extract_ruby(node) }
    visitERBInNode(node: ERBInNode): void { this.extract_ruby(node) }

    extract_ruby(node: ERBNode): void {
        if (!node.content) {
            this.visitChildNodes(node)
            return
        }

        let content = node.content.value.trimStart()
        const startTrimLength = node.content.value.length - content.length
        content = content.trimEnd()

        let erb_position = new Position(node.content.location.start.line, node.content.location.start.column + startTrimLength)

        this.mapping.push({ ruby: this.source_position(), erb: erb_position })
        this.source += content + '\n'

        this.visitChildNodes(node)
    }

    source_position(): Position {
        const lines = this.source.split('\n')
        const line = lines.length
        const column = lines[lines.length - 1].length

        return new Position(line, column)
    }
}

export class ERBRubocopRule extends ParserRule {
    ignored_cops = ["Style/FrozenStringLiteralComment", "Lint/Void"]
    rubocopToLspSeverity: Record<string, LintSeverity> = {
        info: "hint",
        refactor: "info",
        convention: "info",
        warning: "warning",
        error: "error",
        fatal: "error"
    }

    name = "erb-rubocop"

    translate_position(mapping: { ruby: Position; erb: Position }[], rubyPosition: Position): Position {
        let relevantMapping

        for (let i = 0; i < mapping.length; i++) {
            if (mapping[i].ruby.line > rubyPosition.line || mapping[i].ruby.line === rubyPosition.line && mapping[i].ruby.column > rubyPosition.column) {
                relevantMapping = mapping[i - 1]
                break;
            }
        }

        if (!relevantMapping) {
            relevantMapping = mapping[mapping.length - 1]
        }


        const line_offset = relevantMapping.erb.line - relevantMapping.ruby.line
        const column_offset = rubyPosition.line == relevantMapping.ruby.line ? relevantMapping.erb.column - relevantMapping.ruby.column : 0

        return new Position(rubyPosition.line + line_offset, rubyPosition.column + column_offset)
    }

    check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
        const visitor = new ExtractRubyVisitor()
        visitor.visit(result.value)

        console.log("########## extracted #############")
        console.log(visitor.source)

        const formatter_path = path.join(__dirname, "../../json_corrector_formatter.rb")
        let stdout = execSync(`bundle exec rubocop --stdin abc --require ${formatter_path} --format JSONCorrectorFormatter --force-default-config --except ${this.ignored_cops.join(",")} || true`, { input: visitor.source });
        const json = JSON.parse(stdout.toString())

        let offenses: LintOffense[] = []

        for (const offense of json.files[0].offenses) {
            const rubyLocation = new Location(
                new Position(offense.location.start_line, offense.location.start_column - 1),
                new Position(offense.location.last_line, offense.location.last_column)
            )

            const erbLocation = new Location(
                this.translate_position(visitor.mapping, rubyLocation.start),
                this.translate_position(visitor.mapping, rubyLocation.end)
            )


            console.log("####### offense #######")
            console.log(offense)

            console.log("erb location: ")
            console.log(erbLocation)

            offenses.push({
                rule: this.name, code: this.name, source: "Herb Linter", message: offense.message, severity: this.rubocopToLspSeverity[offense.severity], location: erbLocation
            })
        }

        return offenses;
    }
}
