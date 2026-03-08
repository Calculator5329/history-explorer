# Cloud Run Gateway — Required Fixes

## The Problem
The GET handler currently returns `{documents: [], count: 0}` for ALL paths.
It never actually reads from Firestore. The POST handler only creates documents,
there is no query endpoint.

## What Needs to Change

### Fix 1: GET handler must read documents AND list collections

The path segment count determines whether it's a document or collection:
- **Even segments** (e.g., `topics/ww2` = 2) → **document read**
- **Odd segments** (e.g., `topics/ww2/events` = 3) → **collection list**

```javascript
// Express route handler
app.get('/firestore/*', async (req, res) => {
  const path = req.params[0]; // e.g., "topics/ww2" or "topics/ww2/events"
  const segments = path.split('/').filter(Boolean);

  if (segments.length % 2 === 0) {
    // DOCUMENT READ (even segments)
    const doc = await firestore.doc(path).get();
    if (!doc.exists) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Document not found" } });
    }
    return res.json({ id: doc.id, ...doc.data() });
  } else {
    // COLLECTION LIST (odd segments)
    let query = firestore.collection(path);

    // Support optional query params
    const limit = parseInt(req.query.limit) || 100;
    query = query.limit(limit);

    if (req.query.orderBy) {
      const direction = req.query.direction === 'desc' ? 'desc' : 'asc';
      query = query.orderBy(req.query.orderBy, direction);
    }

    const snapshot = await query.get();
    const documents = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ documents, count: documents.length });
  }
});
```

### Expected behavior after fix:

```
GET /firestore/topics/ww2
→ { "id": "ww2", "name": "World War II", "description": "...", "branches": [...] }

GET /firestore/topics/ww2/events
→ { "documents": [{ "id": "pearl_harbor", "title": "Attack on Pearl Harbor", ... }, ...], "count": 27 }

GET /firestore/topics/ww2/events?limit=5&orderBy=date&direction=asc
→ { "documents": [...first 5 events sorted by date...], "count": 5 }

GET /firestore/topics/ww2/events/pearl_harbor
→ { "id": "pearl_harbor", "title": "Attack on Pearl Harbor", "date": "1941-12-07", ... }
```

### Fix 2 (Optional): Add proper query endpoint

If you want POST-based querying with filters:

```javascript
app.post('/firestore/query', async (req, res) => {
  const { collection, where, orderBy, limit } = req.body;

  let query = firestore.collection(collection);

  if (where && Array.isArray(where)) {
    for (const clause of where) {
      query = query.where(clause.field, clause.op, clause.value);
    }
  }
  if (orderBy) {
    const direction = orderBy.direction === 'desc' ? 'desc' : 'asc';
    query = query.orderBy(orderBy.field || orderBy, direction);
  }
  if (limit) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  const documents = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  return res.json({ documents, count: documents.length });
});
```

## Test After Deploy

Run this from the project directory:
```
npx tsx src/scripts/test-firestore.ts
```

All document read and collection list tests should pass.
