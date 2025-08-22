import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBRubocopRule } from "../../src/rules/erb-rubocop.js"

describe("ERBRubocopRule", () => {
    beforeAll(async () => {
        await Herb.load()
    })

    test("valid case", () => {
        const html = dedent`
      <h1>
        <%= title %>
      </h1>
    `
        const linter = new Linter(Herb, [ERBRubocopRule])
        const lintResult = linter.lint(html)

        console.log(lintResult.offenses)
        expect(lintResult.errors).toBe(0)
        expect(lintResult.warnings).toBe(0)
        expect(lintResult.offenses).toHaveLength(0)
    })

    test("single simple offense", () => {
        const html = dedent`
      <h1><%= 'title' %><h1>
    `
        const linter = new Linter(Herb, [ERBRubocopRule])
        const lintResult = linter.lint(html)

        expect(lintResult.errors).toBe(1)
        expect(lintResult.warnings).toBe(0)
        expect(lintResult.offenses).toHaveLength(1)
        expect(lintResult.offenses[0].code).toBe("erb-rubocop")

        expect(lintResult.offenses[0].location.start.line).toBe(1)
        expect(lintResult.offenses[0].location.start.column).toBe(7)
        expect(lintResult.offenses[0].location.end.line).toBe(1)
        expect(lintResult.offenses[0].location.end.column).toBe(15)

    })
})
