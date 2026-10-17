/**
 * Монотонный штамп для id графа: Date.now() + счётчик.
 * Два разреза/кольца/добавления в одну миллисекунду (двойной клик, скрипт)
 * раньше давали дублирующиеся id и повреждали граф.
 */
let counter = 0;

export function uniqueStamp(): string {
  counter = (counter + 1) % 100000;
  return `${Date.now()}-${counter}`;
}
