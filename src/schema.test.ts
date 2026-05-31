import { graphql } from "graphql";
import { MySQLGraphQLConfig } from "../types";
import { DbContext } from "./connection";
import { generateSchema } from "./schema";

const table = {
  TABLE_NAME: "user",
  PKEYS: "id",
  inputs: `input userInput {
    id: Int
    name: String
    tenant_id: Int
  }`,
  types: `type user {
    id: Int
    name: String
    tenant_id: Int
  }`,
};

const createDb = () => {
  const queries: Array<{ sql: string; params?: any[] }> = [];
  const db = {
    database: "test",
    pool: {} as any,
    query: jest.fn(async (sql: string, params?: any[]) => {
      queries.push({ sql, params });
      if (sql.startsWith("SET ")) {
        return [[], []];
      }
      if (sql.includes("INFORMATION_SCHEMA.TABLES")) {
        return [[table], []];
      }
      if (sql.includes("INFORMATION_SCHEMA.KEY_COLUMN_USAGE")) {
        return [[], []];
      }
      if (sql.includes("select * from `user`")) {
        return [[{ id: 1, name: "Ada", tenant_id: 7 }], []];
      }
      if (sql.includes("INSERT IGNORE")) {
        return [{ insertId: 12 }];
      }
      if (sql.includes("UPDATE")) {
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("DELETE")) {
        return [{ affectedRows: 1 }];
      }
      return [[], []];
    }),
    select: jest.fn(),
    first: jest.fn(async () => ({ id: 1, name: "Ada", tenant_id: 7 })),
    close: jest.fn(),
    quit: jest.fn(),
  } as unknown as DbContext;

  return { db, queries };
};

const config: MySQLGraphQLConfig = {
  connection: {
    user: "user",
    password: "password",
    database: "test",
  },
};

describe("generateSchema", () => {
  test("builds query resolvers with validated order and where SQL", async () => {
    const { db, queries } = createDb();
    const schema = await generateSchema(config, db);

    const result = await graphql({
      schema,
      source: `query {
        user(where: "{\\"id\\":1}", order: "name desc", limit: 1) {
          id
          name
        }
      }`,
      contextValue: {
        req: {
          auth: { role: "admin" },
        },
      },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      user: [{ id: 1, name: "Ada" }],
    });
    expect(
      queries.some((query) => query.sql.includes("order by `name` DESC")),
    ).toBe(true);
    expect(queries.some((query) => query.params?.includes(1))).toBe(true);
  });

  test("merges custom resolvers after generated resolvers", async () => {
    const { db } = createDb();
    const schema = await generateSchema(
      {
        ...config,
        custom_queries: "health: String",
        custom_query_resolvers: () => ({
          health: () => "ok",
        }),
      },
      db,
    );

    const result = await graphql({
      schema,
      source: "{ health }",
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ health: "ok" });
  });
});
