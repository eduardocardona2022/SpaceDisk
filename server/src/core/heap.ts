export class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(item: T): void {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  replaceMin(item: T): void {
    if (this.items.length === 0) return;
    this.items[0] = item;
    this.bubbleDown(0);
  }

  toArray(): T[] {
    return [...this.items];
  }

  private bubbleUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      const currentItem = this.items[current];
      const parentItem = this.items[parent];
      if (!currentItem || !parentItem || this.compare(currentItem, parentItem) >= 0) break;
      this.items[current] = parentItem;
      this.items[parent] = currentItem;
      current = parent;
    }
  }

  private bubbleDown(index: number): void {
    let current = index;
    const length = this.items.length;

    while (true) {
      const left = current * 2 + 1;
      const right = left + 1;
      let smallest = current;

      const currentItem = this.items[current];
      const leftItem = this.items[left];
      const rightItem = this.items[right];

      if (leftItem && currentItem && this.compare(leftItem, currentItem) < 0) smallest = left;
      const smallestItem = this.items[smallest];
      if (rightItem && smallestItem && this.compare(rightItem, smallestItem) < 0) smallest = right;

      if (smallest === current) break;

      const a = this.items[current];
      const b = this.items[smallest];
      if (!a || !b) break;
      this.items[current] = b;
      this.items[smallest] = a;
      current = smallest;

      if (current >= length) break;
    }
  }
}
