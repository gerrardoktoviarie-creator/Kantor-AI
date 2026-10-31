Server catatan ini langsung mati waktu dijalanin pakai `node server.js`. Log terakhir:

```
file:///.../server.js:1
const { createServer } = require('node:http');
                         ^
ReferenceError: require is not defined in ES module scope
```

Benerin sampai server nyala dan GET /api/health balikin { "ok": true }. Fitur lain jangan dirusak.
