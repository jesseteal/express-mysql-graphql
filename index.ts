import { createYoga } from "graphql-yoga";
import { GraphQLSchema } from "graphql";
import { createDbContext } from "./src/connection";
import { generateSchema } from "./src/schema";
import { DbConnectionParams, MySQLGraphQLConfig } from "./types";
import { expressjwt } from "express-jwt";

const express = require("express");

/* config options
  graphql_path : path to endpoint, default `/graphql`,
  enable_graphiql : default `false`,
  connection: {
    host     : 'DB_HOST',
    user     : 'DB_USER',
    password : 'PASSWORD',
    database : 'DB_NAME'
  }
*/
const db_connection_defaults: DbConnectionParams = {
  host: "localhost",
  user: "",
  password: "",
  database: "",
};

export const mysqlGraphql = (config: MySQLGraphQLConfig) => {
  const app = express();
  const db = createDbContext({
    ...db_connection_defaults,
    ...config.connection,
  });
  const options = {
    connection: {
      ...db_connection_defaults,
      ...config.connection,
    },
    enable_schema_query: !!config.enable_schema_query,
    rules: config.rules,
    custom_types: config.custom_types,
    custom_merged_inputs: config.custom_merged_inputs,
    custom_merged_types: config.custom_merged_types,
    custom_queries: config.custom_queries,
    custom_mutations: config.custom_mutations,
    custom_query_resolvers: config.custom_query_resolvers,
    custom_mutation_resolvers: config.custom_mutation_resolvers,
    custom_resolvers: config.custom_resolvers,
  };

  app.locals.mysqlGraphql = {
    close: db.close,
  };

  generateSchema(options, db)
    .then((schema: GraphQLSchema) => {
      const path = config.graphql_path || "/graphql";
      const yoga = createYoga({
        schema,
        graphiql: Boolean(config.enable_graphiql),
      });
      if (config.jwt_signature) {
        app.use(
          path,
          expressjwt({
            secret: config.jwt_signature,
            algorithms: ["HS256"],
          }).unless({
            custom: config.jwt_unless,
          }),
          yoga,
        );
      } else {
        app.use(path, yoga);
      }
    })
    .catch((e: any) => console.error("[mys gql]: get_schema error", e));
  return app;
};

export default mysqlGraphql;
export type * from "./types";

module.exports = mysqlGraphql;
module.exports.default = mysqlGraphql;
module.exports.mysqlGraphql = mysqlGraphql;
