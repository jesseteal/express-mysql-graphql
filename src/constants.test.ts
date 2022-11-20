import K from "./constants";

describe("constants", () => {
  test("should generate sql schema string", () => {
    expect(K.SQL_SCHEMA("test")).toBeTruthy();
  });
});
