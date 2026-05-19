function cloneSchema(value) {
  return value && typeof value === "object" ? { ...value } : {};
}

export const Type = {
  String(options = {}) {
    return { type: "string", ...cloneSchema(options) };
  },
  Optional(schema) {
    const next = cloneSchema(schema);
    next.__optional = true;
    return next;
  },
  Object(properties, options = {}) {
    const shape = properties && typeof properties === "object" ? properties : {};
    const normalizedProperties = {};
    const required = [];
    for (const [key, value] of Object.entries(shape)) {
      const schema = cloneSchema(value);
      if (schema.__optional === true) delete schema.__optional;
      else required.push(key);
      normalizedProperties[key] = schema;
    }
    const out = {
      type: "object",
      properties: normalizedProperties,
      additionalProperties: false,
      ...cloneSchema(options),
    };
    if (required.length) out.required = required;
    return out;
  },
};
