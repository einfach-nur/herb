import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import dedent from "dedent"
import { env } from "node:process"

let formatter: Formatter

describe("ERB Formatter Rubocop Tests", () => {
    beforeAll(async () => {
        await Herb.load()

        env.HERB_LINTER_ERB_RUBOCOP_ADDITIONAL_OPTIONS = "--force-default-config"

        formatter = new Formatter(Herb, {
            indentWidth: 2,
            maxLineLength: 80,
        })
    })

    describe("Rubocop Formatter", () => {
        test("formats simple erb files with rubocop offenses", () => {
            const source = dedent`
            <div><%= "Test" %></div>
      `

            const result = formatter.format(source)

            expect(result).toBe(dedent`
            <div><%= 'Test' %></div>
      `)
        })
    })
})
