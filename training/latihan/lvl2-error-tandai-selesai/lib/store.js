const notes = [
  { id: 1, title: 'Belanja bulanan', done: false },
  { id: 2, title: 'Servis motor', done: false },
];

export function listNotes() {
  return notes;
}

export function findNote(id) {
  return notes.find((n) => n.id === id);
}

export function updateNote(id, changes) {
  const note = findNote(id);
  if (!note) return null;
  note = { ...note, ...changes };
  return note;
}
