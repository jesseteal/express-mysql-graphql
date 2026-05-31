import { makeExecutableSchema } from "@graphql-tools/schema";
import { DateResolver, DateTimeResolver } from "graphql-scalars";
import {
  MySQLGraphQLConfig,
  QueryArgs,
  RelationshipMetadata,
  ResolverContext,
  TableMetadata,
} from "../types";
import K from "./constants";
import { DbContext } from "./connection";
import { parseOrderBy, parseWhereArgs } from "./where";
import {
  assertKnownIdentifier,
  numberOrUndefined,
  quoteIdentifier,
} from "./validation";

const tokenFromContext = (context?: ResolverContext) =>
  context?.req?.auth || context?.req?.user || {};

const primaryKeys = (table: TableMetadata) =>
  table.PKEYS.split(",").filter(Boolean);

const primaryKeyWhere = (keys: string[]) =>
  keys.map((key) => `${quoteIdentifier(key)}=?`).join(" AND ");

const primaryKeyValues = (keys: string[], input: Record<string, any>) =>
  keys.map((key) => input[key]);

const hasAllPrimaryKeys = (keys: string[], input: Record<string, any>) =>
  keys.every((key) => input[key] !== undefined && input[key] !== null);

const tableFields = (table: TableMetadata) => {
  const fields = new Set<string>();
  const addMatches = (source: string) => {
    for (const match of source.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)) {
      fields.add(match[1]);
    }
  };
  addMatches(table.inputs);
  addMatches(table.types);
  return fields;
};

const mergeCustomResolvers = (resolvers: any, customResolvers: any) => {
  if (!customResolvers) {
    return;
  }
  for (const key of Object.keys(customResolvers)) {
    resolvers[key] = resolvers[key]
      ? { ...resolvers[key], ...customResolvers[key] }
      : customResolvers[key];
  }
};

const schemaTypeDefs = (
  tables: TableMetadata[],
  options: MySQLGraphQLConfig,
) => {
  const inputs = tables
    .map((table) =>
      options.custom_merged_inputs?.[table.TABLE_NAME]
        ? table.inputs
            .replace("}", "")
            .concat(options.custom_merged_inputs[table.TABLE_NAME], "\n}")
        : table.inputs,
    )
    .join("\n");
  const types =
    tables
      .map((table) =>
        options.custom_merged_types?.[table.TABLE_NAME]
          ? table.types
              .replace("}", "")
              .concat(options.custom_merged_types[table.TABLE_NAME], "\n}")
          : table.types,
      )
      .join("\n") +
    `
      scalar Date
      scalar DateTime
      type schema {
        column: String
        type: String
        required: Int
      }
      ${options.custom_types || ""}
    `;
  const queries =
    `
    type Query {
      schema(table: String!): [schema]
      ${options.custom_queries || ""}
    ` +
    tables
      .map(
        (table) =>
          `${table.TABLE_NAME}(limit: Int, offset: Int, where: String, order: String): [${table.TABLE_NAME}]`,
      )
      .join("\n") +
    `
    }`;
  const mutations =
    `
    type Mutation {
      ${options.custom_mutations || ""}
    ` +
    tables
      .map(
        (table) => `
      create${table.TABLE_NAME}(input: ${table.TABLE_NAME}Input): Int
      update${table.TABLE_NAME}(input: ${table.TABLE_NAME}Input): ${table.TABLE_NAME}
      delete${table.TABLE_NAME}(input: ${table.TABLE_NAME}Input): String
    `,
      )
      .join("\n") +
    `
    }`;

  return inputs + types + queries + mutations;
};

export const generateSchema = async (
  options: MySQLGraphQLConfig,
  db: DbContext,
) => {
  await db.query("SET SESSION group_concat_max_len=900000");
  await db.query("SET GLOBAL group_concat_max_len=900000");

  const schemaQuery = K.schemaStatement(db.database);
  const relationshipQuery = K.relationshipsStatement(db.database);
  const [tables] = await db.query(schemaQuery.sql, schemaQuery.params);
  const [relationships] = await db.query(
    relationshipQuery.sql,
    relationshipQuery.params,
  );
  const tableMetadata = tables as TableMetadata[];
  const relationshipMetadata = relationships as RelationshipMetadata[];
  const tableFieldsByName = new Map(
    tableMetadata.map((table) => [table.TABLE_NAME, tableFields(table)]),
  );

  const resolvers: any = {
    Date: DateResolver,
    DateTime: DateTimeResolver,
    Query: {
      schema: async (_obj: any, args: { table: string }) => {
        if (!options.enable_schema_query) {
          return null;
        }
        const columnQuery = K.columnsStatement(db.database, args.table);
        const [rows] = await db.query(columnQuery.sql, columnQuery.params);
        return rows;
      },
    },
    Mutation: {},
  };

  tableMetadata.forEach((table) => {
    const tableName = table.TABLE_NAME;
    const knownFields = tableFieldsByName.get(tableName);

    resolvers.Query[tableName] = async (
      _obj: any,
      args: QueryArgs,
      context: ResolverContext,
    ) => {
      const token = tokenFromContext(context);
      const { wheres, params, fields } = parseWhereArgs(
        args.where,
        tableName,
        token,
        options,
        false,
        knownFields,
      );
      const order = parseOrderBy(args.order, knownFields);
      const limit = numberOrUndefined(args.limit, "limit");
      const offset = numberOrUndefined(args.offset, "offset");
      const [rows] = await db.query(
        `select ${fields} from ${quoteIdentifier(tableName)}
          ${wheres ? "where " + wheres : ""}
          ${order}
          ${limit !== undefined ? `limit ${limit}` : ""}
          ${offset !== undefined ? `offset ${offset}` : ""}`,
        params,
      );
      return rows;
    };

    resolvers.Mutation[`create${tableName}`] = async (
      _obj: any,
      args: { input: Record<string, any> },
      context: ResolverContext,
    ) => {
      let { input } = args;
      const token = tokenFromContext(context);

      if (options.rules?.[tableName]?.before_insert) {
        const beforeInsertResult = await options.rules[
          tableName
        ].before_insert?.({
          model: input,
          db,
          token,
        });
        if (beforeInsertResult === false) {
          return 0;
        }
        input = beforeInsertResult as Record<string, any>;
      }

      const columns = Object.keys(input);
      columns.forEach((field) =>
        assertKnownIdentifier(field, knownFields || new Set(), "input field"),
      );
      const values = columns.map((field) => input[field]);
      const id = await db
        .query(
          `INSERT IGNORE INTO ${quoteIdentifier(tableName)} (${columns
            .map(quoteIdentifier)
            .join(",")}) values (${columns.map(() => "?").join(",")})`,
          values,
        )
        .then((result: any) => result[0].insertId);

      if (options.rules?.[tableName]?.after_insert) {
        const keys = primaryKeys(table);
        const [rows] = await db.query(
          `select * from ${quoteIdentifier(tableName)} where ${primaryKeyWhere(
            keys,
          )}`,
          primaryKeyValues(keys, input),
        );
        await options.rules[tableName].after_insert?.({
          model: { id, ...input },
          db,
          row: rows[0],
          token,
        });
      }

      return id;
    };

    resolvers.Mutation[`delete${tableName}`] = async (
      _obj: any,
      args: { input: Record<string, any> },
      context: ResolverContext,
    ) => {
      const { input } = args;
      const keys = primaryKeys(table);
      const token = tokenFromContext(context);
      if (!hasAllPrimaryKeys(keys, input)) {
        return "Delete Failed - missing primary keys";
      }

      if (options.rules?.[tableName]?.before_delete) {
        const ok = await options.rules[tableName].before_delete?.({
          model: input,
          db,
          token,
        });
        if (ok === false) {
          return "Delete refused by pre-delete check";
        }
      }

      let model;
      if (options.rules?.[tableName]?.after_delete) {
        model = await db.first(
          `select * from ${quoteIdentifier(tableName)} where ${primaryKeyWhere(
            keys,
          )}`,
          primaryKeyValues(keys, input),
        );
      }

      const [res] = await db.query(
        `DELETE FROM ${quoteIdentifier(tableName)} WHERE ${primaryKeyWhere(
          keys,
        )}`,
        primaryKeyValues(keys, input),
      );

      if (options.rules?.[tableName]?.after_delete) {
        await options.rules[tableName].after_delete?.({
          model,
          db,
          token,
        });
      }

      return `${res.affectedRows} row(s) deleted.`;
    };

    resolvers.Mutation[`update${tableName}`] = async (
      _obj: any,
      args: { input: Record<string, any> },
      context: ResolverContext,
    ) => {
      let { input } = args;
      const keys = primaryKeys(table);
      const token = tokenFromContext(context);

      if (!hasAllPrimaryKeys(keys, input)) {
        return null;
      }

      if (options.rules?.[tableName]?.before_update) {
        const [rows] = await db.query(
          `select * from ${quoteIdentifier(tableName)} where ${primaryKeyWhere(
            keys,
          )}`,
          primaryKeyValues(keys, input),
        );
        const beforeUpdateResult = await options.rules[
          tableName
        ].before_update?.({
          model: input,
          db,
          row: rows[0],
          token,
        });
        if (beforeUpdateResult === false) {
          return null;
        }
        input = beforeUpdateResult as Record<string, any>;
      }

      const setColumns = Object.keys(input).filter(
        (field) => !keys.includes(field),
      );
      setColumns.forEach((field) =>
        assertKnownIdentifier(field, knownFields || new Set(), "input field"),
      );
      if (setColumns.length === 0) {
        const [rows] = await db.query(
          `select * from ${quoteIdentifier(tableName)} where ${primaryKeyWhere(
            keys,
          )}`,
          primaryKeyValues(keys, input),
        );
        return rows[0];
      }
      await db.query(
        `UPDATE ${quoteIdentifier(tableName)}
          SET ${setColumns.map((field) => `${quoteIdentifier(field)}=?`).join(",")}
          WHERE ${primaryKeyWhere(keys)}`,
        setColumns
          .map((field) => input[field])
          .concat(primaryKeyValues(keys, input)),
      );

      const [rows] = await db.query(
        `select * from ${quoteIdentifier(tableName)} where ${primaryKeyWhere(
          keys,
        )}`,
        primaryKeyValues(keys, input),
      );

      if (options.rules?.[tableName]?.after_update) {
        await options.rules[tableName].after_update?.({
          model: input,
          db,
          row: rows[0],
          token,
        });
      }

      return rows[0];
    };
  });

  for (const relationship of relationshipMetadata) {
    const { TABLE_NAME, LINKED_TABLE, TO_COL, FROM_COL } = relationship;
    resolvers[TABLE_NAME] = resolvers[TABLE_NAME] || {};
    resolvers[TABLE_NAME][`${FROM_COL}_${LINKED_TABLE}`] = async (
      parent: Record<string, any>,
      args: QueryArgs,
      context: ResolverContext,
    ) => {
      const { wheres, params } = parseWhereArgs(
        args.where,
        LINKED_TABLE,
        tokenFromContext(context),
        options,
        true,
        tableFieldsByName.get(LINKED_TABLE),
      );
      const [rows] = await db.query(
        `SELECT * FROM ${quoteIdentifier(LINKED_TABLE)}
          WHERE ${quoteIdentifier(TO_COL)} = ?
          ${wheres ? "AND " + wheres : ""}`,
        [parent[FROM_COL], ...params],
      );
      return rows[0];
    };
  }

  for (const relationship of relationshipMetadata) {
    const { TABLE_NAME, LINKED_TABLE, TO_COL, FROM_COL } = relationship;
    resolvers[LINKED_TABLE] = resolvers[LINKED_TABLE] || {};
    if (FROM_COL === TO_COL || TO_COL === "id") {
      resolvers[LINKED_TABLE][TABLE_NAME] = async (
        parent: Record<string, any>,
        args: QueryArgs,
        context: ResolverContext,
      ) => {
        const { wheres, params } = parseWhereArgs(
          args.where,
          TABLE_NAME,
          tokenFromContext(context),
          options,
          true,
          tableFieldsByName.get(TABLE_NAME),
        );
        const order = parseOrderBy(
          args.order,
          tableFieldsByName.get(TABLE_NAME),
        );
        const limit = numberOrUndefined(args.limit, "limit");
        const offset = numberOrUndefined(args.offset, "offset");
        const [rows] = await db.query(
          `SELECT * FROM ${quoteIdentifier(TABLE_NAME)}
            WHERE ${quoteIdentifier(FROM_COL)} = ?
            ${wheres ? "AND " + wheres : ""}
            ${order}
            ${limit !== undefined ? `limit ${limit}` : ""}
            ${offset !== undefined ? `offset ${offset}` : ""}`,
          [parent[TO_COL], ...params],
        );
        return rows;
      };
    }
  }

  mergeCustomResolvers(resolvers, options.custom_resolvers?.(db));
  if (options.custom_query_resolvers) {
    resolvers.Query = {
      ...resolvers.Query,
      ...options.custom_query_resolvers(db),
    };
  }
  if (options.custom_mutation_resolvers) {
    resolvers.Mutation = {
      ...resolvers.Mutation,
      ...options.custom_mutation_resolvers(db),
    };
  }

  return makeExecutableSchema({
    typeDefs: schemaTypeDefs(tableMetadata, options),
    resolvers,
  });
};
