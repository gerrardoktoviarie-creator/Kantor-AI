const notes = [
  { id: 1, title: 'Belanja bulanan', done: false },
  { id: 2, title: 'Servis motor', done: false },
];

export function listNotes() {
  return notes;
}

export function findNote(id) {
  return notes.find((n) => n.id === Number(id));
}

export function updateNote(id, changes) {
  const note = findNote(id);
  if (!note) return null;
  const updated = { ...note };
  if ('title' in changes) updated.title = changes.title;
  if ('done' in changes) updated.done = changes.done;
  Object.assign(note, updated);
  return note;
}