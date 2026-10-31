export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Server RetroGrid gak bisa dihubungi. Masih jalan?');
  }

  // Password-protected install (VPS): send the browser to the login page and come back after.
  if (res.status === 401 && !window.location.pathname.startsWith('/login')) {
    const back = window.location.pathname + window.location.hash;
    window.location.href = `/login.html?next=${encodeURIComponent(back)}`;
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Server balikin error ${res.status}.`);
  return data;
}

// fetch() can't report upload progress, so big video uploads go through XHR.
export function uploadFile(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', path);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data?.error || `Upload gagal (${xhr.status}).`));
    });
    xhr.addEventListener('error', () => reject(new Error('Upload putus. Cek koneksi ke server.')));
    xhr.send(file);
  });
}
