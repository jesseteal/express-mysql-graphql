"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mysgraphile = void 0;
var graphql_yoga_1 = require("graphql-yoga");
var db_1 = require("./src/db");
var express_jwt_1 = require("express-jwt");
var express = require("express");
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
var db_connection_defaults = {
    host: "localhost",
    user: "",
    password: "",
    database: "",
};
var mysgraphile = function (config) {
    var app = express();
    (0, db_1.generate_schema)({
        connection: __assign(__assign({}, db_connection_defaults), config.connection),
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
        .then(function (schema) {
        var path = config.graphql_path || "/graphql";
        var yoga = (0, graphql_yoga_1.createYoga)({
            schema: schema,
            // context: ({ req }: any) => ({ token: 'xxx'}),
            graphiql: Boolean(config.enable_graphiql),
        });
        if (config.jwt_signature) {
            app.use(path, (0, express_jwt_1.expressjwt)({ secret: config.jwt_signature, algorithms: ["HS256"] }), yoga);
        }
        else {
            app.use(path, yoga);
        }
    })
        .catch(function (e) { return console.error("[mys gql]: get_schema error", e); });
    return app;
};
exports.mysgraphile = mysgraphile;
exports.default = exports.mysgraphile;
