const express = require('express');
const { graphqlHTTP } = require('express-graphql');   // https://graphql.org/graphql-js/
const db = require('./db');

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
  host: 'localhost',
  user: '',
  password: '',
  database: ''
}

const mysgraphile = (config) => {
  const app = express();
  db.get_schema({
    connection: {
      ...db_connection_defaults,
      ...config.connection
    },
    enable_schema_query: !!config.enable_schema_query,
    hooks: config.hooks || {},
    custom_types: config.custom_types || null,
    custom_queries: config.custom_queries || null,
    custom_mutations: config.custom_mutations || null,
    custom_query_resolvers: config.custom_query_resolvers || null,
    custom_mutation_resolvers: config.custom_mutation_resolvers || null
  }).then(([schema, rootValue]) => {
    app.use(config.graphql_path || '/graphql', graphqlHTTP({
      schema,
      graphiql: !!config.enable_graphiql,
    }));
  });
  return app;
}

module.exports = mysgraphile;
