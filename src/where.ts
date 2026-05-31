import { MySQLGraphQLConfig } from "../types";
import {
  assertKnownIdentifier,
  isPlainObject,
  quoteIdentifier,
} from "./validation";

export interface WhereArgs {
  wheres: string;
  params: any[];
  fields: string;
}

const isSet = (value: any) => typeof value !== "undefined";

const parseWhereJson = (where?: string) => {
  if (!where) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(where);
    if (!isPlainObject(parsed)) {
      throw new Error("where must be a JSON object");
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `Invalid where JSON: ${error instanceof Error ? error.message : error}`,
    );
  }
};

const parseClause = (
  json: Record<string, any>,
  table: string,
  token: Record<string, any>,
  options: MySQLGraphQLConfig,
  knownFields?: Set<string>,
): WhereArgs => {
  const wheres: string[] = [];
  const params: any[] = [];
  let fields = "*";

  for (const field of Object.keys(json)) {
    const value = json[field];
    const lcField = field.toLowerCase();

    if (lcField === "or" || lcField === "and") {
      if (!Array.isArray(value)) {
        throw new Error(`${field} where operator must be an array`);
      }
      const subWhere = value.map((item) => {
        if (!isPlainObject(item)) {
          throw new Error(`${field} where operator entries must be objects`);
        }
        const result = parseClause(item, table, token, options, knownFields);
        params.push(...result.params);
        return result.wheres;
      });
      wheres.push(`(${subWhere.join(lcField === "and" ? " AND " : " OR ")})`);
      continue;
    }

    if (field === "distinct") {
      if (knownFields) {
        assertKnownIdentifier(String(value), knownFields, "distinct field");
      }
      fields = `distinct ${quoteIdentifier(String(value))}`;
      continue;
    }

    if (knownFields) {
      assertKnownIdentifier(field, knownFields, "where field");
    }
    const quotedField = quoteIdentifier(field);

    if (value === null) {
      wheres.push(`${quotedField} IS NULL`);
    } else if (isPlainObject(value)) {
      if (isSet(value.eq)) {
        wheres.push(`${quotedField} = ?`);
        params.push(value.eq);
      } else if (isSet(value.neq)) {
        if (value.neq === null) {
          wheres.push(`${quotedField} IS NOT NULL`);
        } else {
          wheres.push(`${quotedField} <> ?`);
          params.push(value.neq);
        }
      } else if (isSet(value.gt)) {
        wheres.push(`${quotedField} > ?`);
        params.push(value.gt);
      } else if (isSet(value.gte)) {
        wheres.push(`${quotedField} >= ?`);
        params.push(value.gte);
      } else if (isSet(value.lt)) {
        wheres.push(`${quotedField} < ?`);
        params.push(value.lt);
      } else if (isSet(value.lte)) {
        wheres.push(`${quotedField} <= ?`);
        params.push(value.lte);
      } else if (isSet(value.between)) {
        if (!Array.isArray(value.between) || value.between.length !== 2) {
          throw new Error(`${field}.between must contain exactly two values`);
        }
        wheres.push(`${quotedField} between ? AND ?`);
        params.push(...value.between);
      } else if (isSet(value.like)) {
        wheres.push(`${quotedField} like ?`);
        params.push(value.like);
      } else if (isSet(value.in)) {
        if (!Array.isArray(value.in)) {
          throw new Error(`${field}.in must be an array`);
        }
        wheres.push(`${quotedField} in (?)`);
        params.push(value.in);
      }
    } else {
      wheres.push(`${quotedField} = ?`);
      params.push(value);
    }
  }

  return {
    wheres: wheres.join(" AND "),
    params,
    fields,
  };
};

export const parseWhereArgs = (
  where: string | undefined,
  table: string,
  token: Record<string, any> = {},
  options: MySQLGraphQLConfig,
  subgraph = false,
  knownFields?: Set<string>,
): WhereArgs => {
  const wheres: string[] = [];
  const params: any[] = [];
  const accessLimit = subgraph
    ? options.rules?.[table]?.restrict_subgraph?.(token)
    : options.rules?.[table]?.restrict?.(token);

  if (accessLimit) {
    wheres.push(accessLimit);
  }

  const json = parseWhereJson(where);
  if (!json) {
    return {
      wheres: wheres.join(" AND "),
      params,
      fields: "*",
    };
  }

  const parsed = parseClause(json, table, token, options, knownFields);
  if (parsed.wheres) {
    wheres.push(parsed.wheres);
  }

  return {
    wheres: wheres.join(" AND "),
    params: params.concat(parsed.params),
    fields: parsed.fields,
  };
};

export const where_args = parseWhereArgs;

export const parseOrderBy = (order?: string, knownFields?: Set<string>) => {
  if (!order) {
    return "";
  }
  const clauses = order.split(",").map((part) => {
    const [field, direction] = part.trim().split(/\s+/);
    if (knownFields) {
      assertKnownIdentifier(field, knownFields, "order field");
    }
    const normalizedDirection = (direction || "ASC").toUpperCase();
    if (!["ASC", "DESC"].includes(normalizedDirection)) {
      throw new Error(`Invalid order direction: ${direction}`);
    }
    return `${quoteIdentifier(field)} ${normalizedDirection}`;
  });
  return `order by ${clauses.join(", ")}`;
};
