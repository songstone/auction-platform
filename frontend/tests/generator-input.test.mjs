import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareGeneratorInput } from '../scripts/generator-input.mjs';

function source() {
  return { components: { schemas: {
    Result: { oneOf: [{ $ref: '#/components/schemas/NoSaleResult' }], discriminator: { propertyName: 'status' } },
    NoSaleResult: { type: 'object', required: ['status'], properties: { status: { type: 'string', const: 'NO_SALE' } } },
  } } };
}

test('generator adapter derives wire literals from const and leaves the canonical input unchanged', () => {
  const original = source();
  const adapted = prepareGeneratorInput(original);
  assert.deepEqual(adapted.components.schemas.Result.discriminator.mapping, { NO_SALE: '#/components/schemas/NoSaleResult' });
  assert.ok(!Object.hasOwn(original.components.schemas.Result.discriminator, 'mapping'));
  assert.deepEqual(adapted.components.schemas.NoSaleResult, original.components.schemas.NoSaleResult);
});

test('generator adapter refuses to guess an absent or ambiguous discriminator literal', () => {
  const absent = source();
  delete absent.components.schemas.NoSaleResult.properties.status.const;
  assert.throws(() => prepareGeneratorInput(absent), /unambiguous required const/);
  const duplicate = source();
  duplicate.components.schemas.Result.oneOf.push({ $ref: '#/components/schemas/NoSaleResult' });
  assert.throws(() => prepareGeneratorInput(duplicate), /unambiguous required const/);
});

test('generator adapter refuses conflicting explicit mappings instead of changing contract meaning', () => {
  const conflicting = source();
  conflicting.components.schemas.Result.discriminator.mapping = { WRONG: '#/components/schemas/NoSaleResult' };
  assert.throws(() => prepareGeneratorInput(conflicting), /needs review/);
});
