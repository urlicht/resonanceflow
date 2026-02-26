export class RingBuffer<T> {
  private readonly data: Array<T | undefined>;
  private writeIndex = 0;
  private itemCount = 0;

  constructor(private readonly capacity: number) {
    if (capacity <= 0) {
      throw new Error("ring buffer capacity must be positive");
    }
    this.data = new Array<T | undefined>(capacity);
  }

  clear(): void {
    this.writeIndex = 0;
    this.itemCount = 0;
    this.data.fill(undefined);
  }

  push(item: T): void {
    this.data[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    this.itemCount = Math.min(this.itemCount + 1, this.capacity);
  }

  toArray(): T[] {
    if (this.itemCount === 0) {
      return [];
    }

    const result: T[] = [];
    const start = (this.writeIndex - this.itemCount + this.capacity) % this.capacity;

    for (let i = 0; i < this.itemCount; i += 1) {
      const index = (start + i) % this.capacity;
      const value = this.data[index];
      if (value !== undefined) {
        result.push(value);
      }
    }

    return result;
  }

  get size(): number {
    return this.itemCount;
  }
}
