/**
 * Example domain class.
 *
 * Domain classes live in the domain/ directory and NEVER import
 * @minecraft/server. This keeps them testable under node:test
 * with only the noop stub.
 *
 * SETUP: Replace this with your own domain classes.
 */

export class Example {
  constructor(name) {
    this.name = name;
    this.value = 0;
  }

  increment(amount = 1) {
    this.value += amount;
    return this.value;
  }

  toJSON() {
    return { name: this.name, value: this.value };
  }

  static fromJSON(json) {
    const instance = new Example(json.name);
    instance.value = json.value ?? 0;
    return instance;
  }
}
