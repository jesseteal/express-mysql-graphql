const custom_types = `
    type BasicChartData {
      total: Float
      x: Float
      y: Float
    }
`;

const custom_queries = `
    something: BasicChartData
`;
const custom_query_resolvers = () => ({
  something: () => {
    return { total: 12, x: 1, y: 2 };
  },
});

const custom_resolvers = (db) => ({
  shipment: {
    from: async (parent, args) =>
      await db.first(
        `select * from stop where shipmentId=? and stopType='PU'`,
        [parent.id]
      ),
    to: async (parent, args) =>
      await db.first(
        `select * from stop where shipmentId=? and stopType='Del'`,
        [parent.id]
      ),
  },
});

const custom_merged_types = {
  // include enabled flag from rule_* for use in auditing
  response: `
    enabled: Int
  `,
  shipment: `
    possible_response: [response]
    from: stop
    to: stop
    `,
};
const custom_merged_inputs = {
  user: `
    password: String
  `,
};

module.exports = {
  custom_merged_inputs,
  custom_merged_types,
  custom_types,
  custom_queries,
  custom_query_resolvers,
  custom_resolvers,
};
