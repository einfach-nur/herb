import { assert, beforeAll, describe, expect, test } from "vitest"
import { Herb, isERBNode } from "@herb-tools/node-wasm"
import { Rubocop } from "../src/rubocop.js"
import dedent from "dedent"

describe("Rubocop apply corrections", () => {
  beforeAll(async () => {
    await Herb.load()
    process.env.HERB_LINTER_ERB_RUBOCOP_ADDITIONAL_OPTIONS =
      "--force-default-config"
  })

  test("simple format", () => {
    const result = Herb.parse(dedent`
        <% "test" %>
    `)
    const corrections = Rubocop.corrections(result.value)
    const erbNode = result.value.children[0]

    assert(isERBNode(erbNode))
    const formattedContent = Rubocop.applyCorrectionsToNode(
      erbNode,
      corrections,
    )
    expect(formattedContent).toBe(" 'test' ")
  })

  test("simple format newlines", () => {
    const result = Herb.parse(dedent`
        <%
          "test"
        %>
    `)
    const corrections = Rubocop.corrections(result.value)
    const erbNode = result.value.children[0]

    assert(isERBNode(erbNode))

    const formattedContent = Rubocop.applyCorrectionsToNode(
      erbNode,
      corrections,
    )
    expect(formattedContent).toBe("\n  'test'\n")
  })
})
