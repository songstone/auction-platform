// Tool-only compatibility adapter. No contract files or payload values are changed.
// openapi-typescript 7.13.0 otherwise infers schema names for unmapped discriminators.
export function prepareGeneratorInput(original) {
  const input = structuredClone(original);
  for (const [name, schema] of Object.entries(input.components.schemas)) {
    if (!schema.discriminator) continue;
    const property = schema.discriminator.propertyName;
    if (!Array.isArray(schema.oneOf)) throw new Error(`Review generator support for discriminator ${name}.`);
    const mapping = {};
    for (const branch of schema.oneOf) {
      const reference = branch.$ref;
      if (!reference?.startsWith('#/components/schemas/')) throw new Error(`Expected local discriminator branch: ${name}.`);
      const target = input.components.schemas[reference.slice('#/components/schemas/'.length)];
      const literal = target?.properties?.[property]?.const;
      if (typeof literal !== 'string' || !target.required?.includes(property) || Object.hasOwn(mapping, literal)) {
        throw new Error(`Cannot derive an unambiguous required const mapping: ${name}.`);
      }
      mapping[literal] = reference;
    }
    if (schema.discriminator.mapping
      && JSON.stringify(schema.discriminator.mapping) !== JSON.stringify(mapping)) {
      throw new Error(`Explicit discriminator mapping needs review: ${name}.`);
    }
    schema.discriminator.mapping = mapping;
  }
  return input;
}
