// Called by the "Tandai selesai" button on each note.
export async function markDone(id) {
  const res = await fetch(`/api/notes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done: true }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}
