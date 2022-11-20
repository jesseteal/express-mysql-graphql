module.exports = {
  something: {
    restrict: (jwt) => {
      console.log({ jwt });
      return "id=2";
    },
    before_insert: (props) => {
      return props.model;
    },
    after_insert: ({ model }) => {
      console.log("inserted", { model });
    },
    before_update: ({ model }) => {
      console.log("updating", { model });
      return model;
    },
    after_update: ({ model }) => {
      console.log("updated", { model });
    },
    before_delete: () => {
      return true;
    },
    after_delete: () => {
      console.log("deleted");
    },
  },
};
