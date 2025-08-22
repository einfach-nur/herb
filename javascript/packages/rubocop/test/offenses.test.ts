import { beforeAll, describe, expect, test } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Rubocop } from "../src/rubocop.js"
import dedent from "dedent"

describe("Rubocop", () => {
  beforeAll(async () => {
    await Herb.load()
    process.env.HERB_LINTER_ERB_RUBOCOP_ADDITIONAL_OPTIONS =
      "--force-default-config"
  })

  test("does not fail if no ruby", () => {
    let result = Herb.parse(dedent`
      <h1>Hello</h1>
     `)
    let offenses = Rubocop.offenses(result.value)
    expect(offenses).toHaveLength(0)
  })

  test("no offenses", () => {
    let result = Herb.parse(dedent`
        <h1><%= 'test' %></h1>
    `)
    let offenses = Rubocop.offenses(result.value)
    expect(offenses).toHaveLength(0)
  })

  test("a single single-line non-correctable offense", () => {
    let result = Herb.parse(dedent`
        <h1><% IAMwrong = 5 %></h1>
    `)
    let offenses = Rubocop.offenses(result.value)
    expect(offenses).toHaveLength(1)
    expect(offenses[0].copName.length).toBeGreaterThan(0)
    expect(offenses[0].message.length).toBeGreaterThan(0)
    expect(offenses[0].correctable).toBe(false)
    expect(offenses[0].corrections).toHaveLength(0)
    expect(offenses[0].location.start.line).toBe(1)
    expect(offenses[0].location.start.column).toBe(7)
    expect(offenses[0].location.end.line).toBe(1)
    expect(offenses[0].location.end.column).toBe(15)
  })

  test("a single offense in an erb tag that starts with weird whitespace", () => {
    let result = Herb.parse(dedent`
        <h1>
          <%  
                
            
                "test"
          %>
        </h1>
    `)
    let offenses = Rubocop.offenses(result.value)
    expect(offenses).toHaveLength(1)
    expect(offenses[0].copName.length).toBeGreaterThan(0)
    expect(offenses[0].message.length).toBeGreaterThan(0)

    expect(offenses[0].location.start.line).toBe(5)
    expect(offenses[0].location.start.column).toBe(8)
    expect(offenses[0].location.end.line).toBe(5)
    expect(offenses[0].location.end.column).toBe(14)
  })

  test("a single single-line correctable offense", () => {
    let result = Herb.parse(dedent`
        <h1><%= "test" %></h1>
    `)
    let offenses = Rubocop.offenses(result.value)
    expect(offenses).toHaveLength(1)
    expect(offenses[0].copName.length).toBeGreaterThan(0)
    expect(offenses[0].message.length).toBeGreaterThan(0)
    expect(offenses[0].correctable).toBe(true)
    expect(offenses[0].corrections).toHaveLength(1)
    expect(offenses[0].location.start.line).toBe(1)
    expect(offenses[0].location.start.column).toBe(8)
    expect(offenses[0].location.end.line).toBe(1)
    expect(offenses[0].location.end.column).toBe(14)
    expect(offenses[0].corrections[0].string.length).toBeGreaterThan(0)
    expect(offenses[0].corrections[0].location.start.line).toBe(1)
    expect(offenses[0].corrections[0].location.start.column).toBe(8)
    expect(offenses[0].corrections[0].location.end.line).toBe(1)
    expect(offenses[0].corrections[0].location.end.column).toBe(14)
  })

  test("multiple offenses", () => {
    let result = Herb.parse(dedent`
        <h1><%= "test" %><%= "another" %></h1>
    `)
    let offenses = Rubocop.offenses(result.value)
    expect(offenses).toHaveLength(2)
  })

  test("a single single-line offense in an erb tag with multiple lines", () => {
    let result = Herb.parse(dedent`
        <h1><%= [1..2].map do |number|
          ["number", number]
        end %></h1>
    `)
    let offenses = Rubocop.offenses(result.value)
    expect(offenses).toHaveLength(1)
    expect(offenses[0].location.start.line).toBe(2)
    expect(offenses[0].location.start.column).toBe(3)
    expect(offenses[0].location.end.line).toBe(2)
    expect(offenses[0].location.end.column).toBe(11)
    expect(offenses[0].location).toEqual(offenses[0].corrections[0].location)
  })

  test("a single multi-line offense in an erb tag with multiple lines", () => {
    let result = Herb.parse(dedent`
        <h1><%= condition ?
          bar :
          baz %></h1>
    `)
    let offenses = Rubocop.offenses(result.value)
    expect(offenses).toHaveLength(1)
    expect(offenses[0].location.start.line).toBe(1)
    expect(offenses[0].location.start.column).toBe(8)
    expect(offenses[0].location.end.line).toBe(3)
    expect(offenses[0].location.end.column).toBe(5)
    expect(offenses[0].location).toEqual(offenses[0].corrections[0].location)
  })

  test("a single multi-line offense over multiple erb tags", () => {
    let result = Herb.parse(dedent`
        <% 3.times { %>
            <h1>why</h1>
        <% } %>
      `)
    let offenses = Rubocop.offenses(result.value)
    expect(offenses).toHaveLength(1)
    expect(offenses[0].location.start.line).toBe(1)
    expect(offenses[0].location.start.column).toBe(11)
    expect(offenses[0].location.end.line).toBe(1)
    expect(offenses[0].location.end.column).toBe(12)
    expect(offenses[0].corrections).toHaveLength(2)
    expect(offenses[0].corrections[0].location.start.line).toBe(1)
    expect(offenses[0].corrections[0].location.start.column).toBe(11)
    expect(offenses[0].corrections[0].location.end.line).toBe(1)
    expect(offenses[0].corrections[0].location.end.column).toBe(12)
    expect(offenses[0].corrections[1].location.start.line).toBe(3)
    expect(offenses[0].corrections[1].location.start.column).toBe(3)
    expect(offenses[0].corrections[1].location.end.line).toBe(3)
    expect(offenses[0].corrections[1].location.end.column).toBe(4)
  })
})
