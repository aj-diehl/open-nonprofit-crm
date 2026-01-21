# Performance Strategy (NonprofitOS)

## Strategy Summary
Focus on the biggest sources of perceived lag first: reduce repeated request fan-out, move heavy aggregation into the database, and push long-running work into background jobs. Then harden scale by adding indexes for the hottest query paths and simple UX loading states to keep navigation feeling instant.

## Latency Pain Points (Observed in Code)
- Repeated viewer lookups per navigation: `getViewer()` is called in layout and many pages, which triggers multiple `auth.getUser` and profile/org queries per click.
- Dashboard series aggregated in application code: donations are fetched and summed in JS for each range, which scales linearly with data size.
- Imports and document ingestion are synchronous: large spreadsheets and embeddings run in-request, causing long waits and potential timeouts.
- Search without supporting indexes: donor search uses `ILIKE` across multiple fields with no trigram indexes, which degrades as data grows.
- Polling queries without composite indexes: background job polling queries filter by org/user/status/completion time but only have single-column indexes.

## Opportunities + Rationale
- Cache viewer context per request: removes duplicate DB roundtrips while keeping auth correctness.
- Aggregate dashboard series in SQL: shifts work to the DB, reducing payload size and CPU time in Node.
- Add composite and trigram indexes: make common list views and search filters scale predictably.
- Make long-running workflows asynchronous: keep UI responsive while heavy work happens in the background and notify on completion.
- Add loading skeletons: improves perceived responsiveness even when server work is still ongoing.

## Technical Breakdown (What Changed)
- Cached viewer lookups: `src/lib/auth/getViewer.ts` now uses React `cache()` with a non-cached helper for tests.
- Server-side donation series aggregation: `src/lib/dashboard/series.ts` calls a new RPC instead of loading all donations.
- New RPC for dashboard series: `supabase/migrations/20260116005000_add_dashboard_donation_series.sql`.
- Performance indexes: `supabase/migrations/20260116004000_add_perf_indexes.sql` adds composite/trigram/vector indexes.
- Async imports: `src/app/app/crm/import/actions.ts` now schedules a background job and returns immediately.
- Async document ingestion: `src/app/app/knowledge/actions.ts` and `src/app/app/grants/[id]/actions.ts` queue background processing.
- Loading skeleton: `src/app/app/loading.tsx` provides route-level loading UI.
- Added tests that surface runtime considerations:
  - `tests/lib/dashboardSeries.test.ts` confirms RPC aggregation and month fill behavior.
  - `tests/lib/auth.test.ts` includes a caching test to ensure viewer lookups are deduped.

## Non-Technical Process (System Thinker View)
1) Baseline the experience
   - Track click-to-content time on key routes (dashboard, donors, grants, knowledge, comms).
   - Note where the UI feels blocked vs. where it feels fast but still working.

2) Remove redundant work
   - Eliminate repeated lookups per page (viewer/profile/org).
   - Push repeated sums/rollups into the database.

3) Prioritize user flow continuity
   - Any task that takes seconds (imports, embeddings, AI runs) should move to background.
   - Confirm the user always gets a visible "work started" indicator and a completion notification.

4) Make scale predictable
   - Add or adjust indexes for every query that sorts/filters frequently.
   - Add search indexes for any partial-match field (`ILIKE` or keyword search).

5) Verify and iterate
   - Use the test suite as guardrails for behavior and data flow.
   - Add targeted metrics/logging around the slowest routes to identify the next bottleneck.

## Suggested Next Pass (If You Want to Extend)
- Stand up a dedicated background worker (queue + cron) for imports and document indexing.
- Add server timing headers or structured logs for route performance.
- Add a search API with full-text or vector search for donors and documents.
