import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { shortAddress } from '../src/lib/short-address';

describe('shortAddress', () => {
  it('shortens a long address with the default widths', () => {
    assert.equal(shortAddress('123456789ABCDEFGH'), '1234...EFGH');
  });

  it('leaves an address unchanged when shortening would not save space', () => {
    assert.equal(shortAddress('123456789'), '123456789');
  });

  it('supports explicit prefix and suffix widths', () => {
    assert.equal(shortAddress('abcdefghijk', 3, 2), 'abc...jk');
  });
});
