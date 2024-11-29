import { redis } from './redis';

describe('redis', () => {
  it('should work', () => {
    expect(redis()).toEqual('redis');
  });
});
