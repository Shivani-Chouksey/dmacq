# Activity Feed 

Writing up my answers for the four questions here. The actual code is in the
`server/` folder (Express + MongoDB) and `client/` folder (React). 

## Point 2 - The slow skip() query

This is the query that's slow:

```js
db.activities
  .find({ tenantId })
  .sort({ createdAt: -1 })
  .skip(page * 20)   // page 5000 means skip 100000
  .limit(20);
```

Why it's slow:

`skip(N)` doesn't jump directly to record N. Mongo reads through the first N
documents and throws them away, and only then returns the next 20. So on page
5000 it ends up reading 100,000 rows just to give back 20. The further you
paginate, the slower it gets. First page is fine, deep pages are painful.

There's also a correctness problem that's easy to miss. New activities keep
coming in at the top of the feed, which shifts all the offsets down. So while a
user is scrolling, they end up seeing the same item twice or skipping over some.

So skip is okay for a few pages but it doesn't hold up for an infinite feed.

How I'd fix it (cursor pagination):

Instead of skipping the first N rows, I remember where the last page ended and
ask for everything after that. The cursor is just the createdAt of the last item
I already showed.

```js
const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

const filter = { tenantId };                       // always scope to the tenant
if (cursor) filter.createdAt = { $lt: new Date(cursor) };

const docs = await db.activities
  .find(filter)
  .sort({ createdAt: -1 })
  .limit(limit + 1)   // one extra row tells me if there's a next page
  .lean();

const hasMore    = docs.length > limit;
const data       = hasMore ? docs.slice(0, limit) : docs;
const nextCursor = hasMore ? data[data.length - 1].createdAt.toISOString() : null;
```

With `createdAt: { $lt: cursor }` Mongo jumps straight to the right place in the
index and reads about 20 rows, no matter how deep the user is. Page 5000 costs
the same as page 1. And because the cursor is a value instead of a position, new
inserts don't break the paging, so no duplicates and no skipped rows.

One thing I'd add for production: if two activities can land on the exact same
createdAt, I'd also put _id in the cursor and sort by `{ createdAt: -1, _id: -1 }`
so the ordering is always unique.

The index:

```js
db.activities.createIndex({ tenantId: 1, createdAt: -1 });
```

I put the exact-match field first and the sort field second. tenantId is an exact
match on every query so it goes first, then createdAt covers both the `$lt`
filter and the sort. The nice part is Mongo can use this one index for the sort
too, so it doesn't have to sort everything in memory, which is usually what kills
these queries.

What I'd keep an eye on (a few simple ones):

- Response time, mainly p95/p99 instead of the average. p95 just means 95% of
  requests were faster than that number, so it catches the slow ones that an
  average hides. If this goes up, users are feeling it.

- Docs examined vs docs returned (totalDocsExamined vs nReturned in explain()).
  These should be close. If I ask for 20 rows but Mongo scanned 100,000 to find
  them, the index isn't being used properly.

- Error rate, basically how many requests come back as 500 or time out. A few is
  normal, but a sudden jump usually means something broke or the DB is overloaded.
  It's an easy one to set an alert on and it tells you a lot.

## Point 4 - Optimistic update and rollback

The idea is to not make the user wait on a spinner when they create something. I
add the item to the list right away, then sort it out once the API responds.

```js
async function addActivity(payload) {
  const tempId = `temp_${++seq}`;
  const optimistic = { ...payload, _id: tempId, _status: "pending",
                       createdAt: new Date().toISOString() };

  setActivities((prev) => [optimistic, ...prev]);            // show it right away

  try {
    const { data: saved } = await createActivity({ payload }); // call the API
    setActivities((prev) =>                                    // swap temp for the real one
      prev.map((a) => (a._id === tempId ? { ...saved, _status: "ok" } : a)));
    return { ok: true };
  } catch (err) {
    setActivities((prev) => prev.filter((a) => a._id !== tempId)); // rollback
    setError(`Failed to create activity: ${err.message}`);
    return { ok: false };
  }
}
```

How the rollback works when the API fails:

The temporary item gets its own id (temp_N). If the call fails, I just filter
that one id out of the list. Since I'm matching the exact temp id, I only remove
the item that failed and leave everything else alone, including any activities
that arrived over the websocket while I was waiting.

I always use the function form of setActivities (prev => ...) here. That way the
rollback works off the latest version of the list instead of a stale copy from
when the request started. If you don't do this you can end up deleting items that
came in during the request.

While the request is going, I show the item in a pending style (greyed out, with
"sending..."), so the user can tell what's saved and what isn't yet. If it fails
the row disappears and they get an error message, so the list always ends up
matching what's really in the database. I also keep their form input on failure
so they can just submit again.

## Point 5 - Scaling to 50M activities per tenant

Indexing:

I'd keep the `{ tenantId: 1, createdAt: -1 }` index since that's what the feed
uses, and add _id for the tie-breaker. At this size the main goal is keeping the
index small enough to stay in memory, so I'd keep the documents lean. If metadata
can get large, I'd store it in S3 and keep just a reference in Mongo. I'd only add
more indexes (like one on type) if there's an actual query that needs it, since
every extra index makes writes slower.

Sharding:

I'd shard on `{ tenantId: 1, createdAt: 1 }`. Putting tenantId first keeps each
tenant's data together, so a feed query hits one shard instead of asking all of
them. Adding createdAt means one tenant's 50M docs get split into chunks rather
than turning into a single giant chunk that can't be balanced. I'd avoid sharding
on createdAt by itself, because then every new write hits the newest shard and
that one shard becomes a hot spot.

Hot tenant isolation:

Some tenants are always going to be much bigger than the rest. I'd track
per-tenant numbers (ops/sec, p99) to find them, then move the heavy ones onto
their own shards with zone sharding. Because the shard key already starts with
tenantId, this is just moving data around, not a redesign. I'd also put per-tenant
rate limits on writes so one busy tenant can't use up all the connections, and
cache the first page of the busiest feeds in Redis to take load off Mongo.

Data retention:

Activity data gets old fast, nobody scrolls back six months. So I wouldn't keep
everything hot forever. A few options:

- A TTL index that auto-deletes after something like 90 to 180 days.
- Or monthly collections that I just drop when they're old, which is a lot cheaper
  than TTL deletes when you're removing millions of rows.
- Move the old data to cheaper storage like S3 if it's needed for compliance or
  reporting, and keep only the recent window in Mongo.

WebSocket vs SSE:

Quick definitions first. SSE (Server-Sent Events) is a one-way connection: the
browser opens a normal HTTP request, the server keeps it open and keeps pushing
new data down to the client. The client can't send anything back on it. WebSocket
is a two-way connection, so both the client and the server can send messages to
each other any time.

For a feed like this I'd lean towards SSE. The feed is basically one direction:
the server pushes new activities to the client and that's it. SSE is just plain
HTTP, it reconnects on its own, and it works through proxies and load balancers
without extra setup.

I'd go with WebSocket when the client also needs to send a lot back in real time,
like live collaboration, presence, or typing indicators. For a read-only feed
that's more than needed. In this project I used WebSocket mainly to show the
two-way setup working, but for just a feed SSE would be the simpler choice.

## Point 6 - Code review of the useEffect

```js
useEffect(() => {
  fetchActivities().then(setActivities);
}, [activities]); // bug
```

The bug:

This effect depends on activities, but it also sets activities every time it
runs. So it runs, fetches, updates state, the state change causes a re-render,
the dependency changed so the effect runs again, and so on. It never stops. It's
an infinite loop of fetches.

What happens in production:

I've seen this kind of thing knock over a staging API. It hits the backend
non-stop, so you can blow past rate limits, run out of DB connections, and run up
the bill. On the frontend the constant re-rendering makes the page lag or freeze.
And since the fetches overlap, responses can come back out of order and the list
flickers between old and new data.

The fix:

Usually you just want to fetch once when the component mounts, so the dependency
array should be empty. I also add an AbortController to cancel the request if the
component unmounts, which avoids the out-of-order problem:

```js
useEffect(() => {
  const controller = new AbortController();
  fetchActivities({ signal: controller.signal })
    .then(setActivities)
    .catch((err) => { if (err.name !== "AbortError") console.error(err); });
  return () => controller.abort();
}, []); // run once on mount
```

If it really does need to refetch when something changes, I'd depend on that
specific thing, like [tenantId] or [filter], not on the data the effect itself
writes.

How I avoid this:

- Simple rule I follow: don't put a value in the dependency array that the effect
  itself updates. Depend on the trigger, not the result.
- Always clean up async effects so old requests don't race each other.
