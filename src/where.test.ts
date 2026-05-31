import { MySQLGraphQLConfig } from "../types";
import { parseOrderBy, parseWhereArgs } from "./where";

const config: MySQLGraphQLConfig = {
  connection: {
    user: "user",
    password: "password",
    database: "test",
  },
  rules: {
    user: {
      restrict: (token) => (token.role === "admin" ? null : "tenant_id=1"),
      restrict_subgraph: () => "visible=1",
    },
  },
};

const fields = new Set(["id", "name", "tenant_id", "visible", "created_at"]);

describe("parseWhereArgs", () => {
  test("returns an empty predicate for empty input", () => {
    expect(parseWhereArgs(undefined, "user", {}, config)).toEqual({
      wheres: "tenant_id=1",
      params: [],
      fields: "*",
    });
  });

  test("parses equality, range, like, in, and null operators", () => {
    const result = parseWhereArgs(
      JSON.stringify({
        id: { gt: 1 },
        name: { like: "A%" },
        tenant_id: { in: [1, 2] },
        created_at: { between: ["2026-01-01", "2026-01-31"] },
        visible: null,
      }),
      "user",
      { role: "admin" },
      config,
      false,
      fields,
    );

    expect(result.wheres).toBe(
      "`id` > ? AND `name` like ? AND `tenant_id` in (?) AND `created_at` between ? AND ? AND `visible` IS NULL",
    );
    expect(result.params).toEqual([
      1,
      "A%",
      [1, 2],
      "2026-01-01",
      "2026-01-31",
    ]);
  });

  test("parses nested and/or predicates", () => {
    const result = parseWhereArgs(
      JSON.stringify({
        or: [{ id: 1 }, { and: [{ name: "Ada" }, { tenant_id: 2 }] }],
      }),
      "user",
      { role: "admin" },
      config,
      false,
      fields,
    );

    expect(result.wheres).toBe(
      "(`id` = ? OR (`name` = ? AND `tenant_id` = ?))",
    );
    expect(result.params).toEqual([1, "Ada", 2]);
  });

  test("supports distinct field selection and subgraph restrictions", () => {
    const result = parseWhereArgs(
      JSON.stringify({ distinct: "name" }),
      "user",
      {},
      config,
      true,
      fields,
    );

    expect(result).toEqual({
      wheres: "visible=1",
      params: [],
      fields: "distinct `name`",
    });
  });

  test("rejects malformed JSON and unknown fields", () => {
    expect(() => parseWhereArgs("{bad", "user", {}, config)).toThrow(
      "Invalid where JSON",
    );
    expect(() =>
      parseWhereArgs(
        JSON.stringify({ unknown: 1 }),
        "user",
        {},
        config,
        false,
        fields,
      ),
    ).toThrow("Unknown where field");
    expect(() =>
      parseWhereArgs(
        JSON.stringify({ distinct: "unknown" }),
        "user",
        {},
        config,
        false,
        fields,
      ),
    ).toThrow("Unknown distinct field");
  });
});

describe("parseOrderBy", () => {
  test("normalizes valid order clauses", () => {
    expect(parseOrderBy("name desc, id", fields)).toBe(
      "order by `name` DESC, `id` ASC",
    );
  });

  test("rejects invalid order fields and directions", () => {
    expect(() => parseOrderBy("name sideways", fields)).toThrow(
      "Invalid order direction",
    );
    expect(() => parseOrderBy("missing desc", fields)).toThrow(
      "Unknown order field",
    );
  });
});
