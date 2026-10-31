const list = document.querySelector('#list');

try {
  const res = await fetch('/api/todos');
  if (!res.ok) throw new Error(`Gagal ambil data (${res.status})`);
  for (const todo of await res.json()) {
    const item = document.createElement('li');
    item.textContent = `${todo.done ? '✓' : '○'} ${todo.title}`;
    list.append(item);
  }
} catch (err) {
  document.querySelector('#error').textContent = err.message;
}
