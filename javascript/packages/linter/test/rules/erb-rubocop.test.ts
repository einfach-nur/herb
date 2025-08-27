import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { env } from "node:process"

import { ERBRubocopRule } from "../../src/rules/erb-rubocop.js"

describe("ERBRubocopRule", () => {
    beforeAll(async () => {
        await Herb.load()
        env.HERB_LINTER_ERB_RUBOCOP_ADDITIONAL_OPTIONS = "--force-default-config"
    })

    test("does not fail if no ruby", () => {
        const html = dedent`
            <h1>Lol</h1>
        `
        const linter = new Linter(Herb, [ERBRubocopRule])
        const lintResult = linter.lint(html)

        expect(lintResult.errors).toBe(0)
        expect(lintResult.warnings).toBe(0)
        expect(lintResult.offenses).toHaveLength(0)
    })

    test("valid case", () => {
        const html = dedent`
            <h1>
                <%= title %>
            </h1>
        `
        const linter = new Linter(Herb, [ERBRubocopRule])
        const lintResult = linter.lint(html)

        expect(lintResult.errors).toBe(0)
        expect(lintResult.warnings).toBe(0)
        expect(lintResult.offenses).toHaveLength(0)
    })

    test("single offense", () => {
        const html = dedent`
            <h1><%= "title" %></h1>
        `
        const linter = new Linter(Herb, [ERBRubocopRule])
        const lintResult = linter.lint(html)

        expect(lintResult.offenses).toHaveLength(1)
        expect(lintResult.offenses[0].code).toBe("erb-rubocop")

        expect(lintResult.offenses[0].message.split(":")[0]).toBe("Style/StringLiterals")
        expect(lintResult.offenses[0].location.start.line).toBe(1)
        expect(lintResult.offenses[0].location.start.column).toBe(8)
        expect(lintResult.offenses[0].location.end.line).toBe(1)
        expect(lintResult.offenses[0].location.end.column).toBe(15)
    })

    test("two offenses", () => {
        const html = dedent`
            <h1><%= "title" %></h1>
            <p><%= "paragraph" %></p>
        `
        const linter = new Linter(Herb, [ERBRubocopRule])
        const lintResult = linter.lint(html)

        expect(lintResult.offenses).toHaveLength(2)
        expect(lintResult.offenses[0].code).toBe("erb-rubocop")

        expect(lintResult.offenses[0].location.start.line).toBe(1)
        expect(lintResult.offenses[0].location.start.column).toBe(8)
        expect(lintResult.offenses[0].location.end.line).toBe(1)
        expect(lintResult.offenses[0].location.end.column).toBe(15)

        expect(lintResult.offenses[1].location.start.line).toBe(2)
        expect(lintResult.offenses[1].location.start.column).toBe(7)
        expect(lintResult.offenses[1].location.end.line).toBe(2)
        expect(lintResult.offenses[1].location.end.column).toBe(18)
    })

    //TODO: decide on indentation style or ignore rubocop rule
    test("multiline indentation", () => {
        const html = dedent`
            <h1><%= [1..2].each do |number|
              number
            end %></h1>
        `
        const linter = new Linter(Herb, [ERBRubocopRule])
        const lintResult = linter.lint(html)

        expect(lintResult.offenses).toHaveLength(0)
    })

    test("multiline erb tag offense", () => {
        const html = dedent`
            <h1><%= [1..2].map do |number|
              ["number", number]
            end %></h1>
        `
        const linter = new Linter(Herb, [ERBRubocopRule])
        const lintResult = linter.lint(html)

        expect(lintResult.offenses).toHaveLength(1)
        expect(lintResult.offenses[0].code).toBe("erb-rubocop")

        expect(lintResult.offenses[0].location.start.line).toBe(2)
        expect(lintResult.offenses[0].location.start.column).toBe(3)
        expect(lintResult.offenses[0].location.end.line).toBe(2)
        expect(lintResult.offenses[0].location.end.column).toBe(11)
    })

    test("multiline offense", () => {
        const html = dedent`
            <h1><%= condition ?
              bar :
              baz %></h1>
        `
        const linter = new Linter(Herb, [ERBRubocopRule])
        const lintResult = linter.lint(html)

        expect(lintResult.offenses).toHaveLength(1)
        expect(lintResult.offenses[0].code).toBe("erb-rubocop")

        expect(lintResult.offenses[0].location.start.line).toBe(1)
        expect(lintResult.offenses[0].location.start.column).toBe(8)
        expect(lintResult.offenses[0].location.end.line).toBe(3)
        expect(lintResult.offenses[0].location.end.column).toBe(5)
    })
})
