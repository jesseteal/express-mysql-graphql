import { DbConnectionParams, MySQLGraphQLConfig } from "../types";
import { createDbContext, DbContext } from "./connection";
import { generateSchema } from "./schema";
export { parseWhereArgs, where_args } from "./where";

let defaultDb: DbContext | null = null;

const defaultConnection: DbConnectionParams = {
  host: "localhost",
  user: "",
  password: "",
  database: "",
};

const getDefaultDb = () => {
  if (!defaultDb) {
    defaultDb = createDbContext(defaultConnection);
  }
  return defaultDb;
};

export const createDatabase = createDbContext;

export const query = async (...args: any[]) => getDefaultDb().query(...args);

export const select = async (...args: any[]) => getDefaultDb().select(...args);

export const first = async (...args: any[]) => getDefaultDb().first(...args);

export { generateSchema };

export default {
  first,
  query,
  select,
  quit: async () => defaultDb?.close(),
};
