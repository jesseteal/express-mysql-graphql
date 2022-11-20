const rules = require('./rules');

module.exports = {
  before_insert: async (table, model, db) => {
    return rules[table]?.before_insert?.(model, db) || model;
  },

  after_insert: async (table, model, db) => {
    rules[table]?.after_insert?.(model, db);
  },

  before_update: async (table, model, db) => {
    return rules[table]?.before_update?.(model, db) || model;
  },
  after_update: async (table, model, db, row) => {
    rules[table]?.after_update?.(model, db, row);
  },
  before_delete: async (table, model, db) => {
    let proceed = true;
    return proceed;
  },
  after_delete: async (table, model, db) => {},
};
