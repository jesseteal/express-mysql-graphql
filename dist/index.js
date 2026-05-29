"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mysgraphile = void 0;
const graphql_yoga_1 = require("graphql-yoga");
const db_1 = require("./src/db");
const express_jwt_1 = require("express-jwt");
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
const db_connection_defaults = {
    host: "localhost",
    user: "",
    password: "",
    database: "",
};
const mysgraphile = (config) => {
    const app = express();
    (0, db_1.generate_schema)({
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
    })
        .then((schema) => {
        const path = config.graphql_path || "/graphql";
        const yoga = (0, graphql_yoga_1.createYoga)({
            schema,
            // context: ({ req }: any) => ({ token: 'xxx'}),
            graphiql: Boolean(config.enable_graphiql),
        });
        if (config.jwt_signature) {
            app.use(path, (0, express_jwt_1.expressjwt)({
                secret: config.jwt_signature,
                algorithms: ["HS256"],
            }).unless({
                custom: config.jwt_unless,
            }), yoga);
        }
        else {
            app.use(path, yoga);
        }
    })
        .catch((e) => console.error("[mys gql]: get_schema error", e));
    return app;
};
exports.mysgraphile = mysgraphile;
exports.default = exports.mysgraphile;
module.exports = exports.mysgraphile;
module.exports.default = exports.mysgraphile;
module.exports.mysgraphile = exports.mysgraphile;
