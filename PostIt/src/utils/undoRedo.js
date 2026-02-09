export function createHistory(initialState, maxSize = 50) {
  let stack = [JSON.parse(JSON.stringify(initialState))];
  let index = 0;

  function get() {
    return JSON.parse(JSON.stringify(stack[index]));
  }

  function push(state) {
    const next = JSON.parse(JSON.stringify(state));
    stack = stack.slice(0, index + 1);
    stack.push(next);
    if (stack.length > maxSize) stack.shift();
    index = stack.length - 1;
  }

  function undo() {
    if (index <= 0) return null;
    index -= 1;
    return get();
  }

  function redo() {
    if (index >= stack.length - 1) return null;
    index += 1;
    return get();
  }

  function canUndo() {
    return index > 0;
  }

  function canRedo() {
    return index < stack.length - 1;
  }

  function replaceCurrent(state) {
    stack[index] = JSON.parse(JSON.stringify(state));
  }

  return { get, push, undo, redo, canUndo, canRedo, replaceCurrent };
}
