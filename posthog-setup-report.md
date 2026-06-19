<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the DevEvent Next.js App Router project. PostHog is initialized via `instrumentation-client.ts` (the recommended approach for Next.js 15.3+), with a reverse proxy configured in `next.config.ts` so all analytics traffic routes through `/ingest` instead of hitting PostHog directly — improving ad-blocker resilience. A server-side PostHog client (`lib/posthog-server.ts`) was created for future API route instrumentation. Three components were updated to capture user interaction events.

| Event Name | Description | File |
|---|---|---|
| `explore_events_clicked` | User clicks the 'Explore Events' button on the homepage to scroll down to the event listings. | `components/ExploreBtn.tsx` |
| `event_card_clicked` | User clicks on an event card to navigate to the event detail page. Includes `event_slug`, `event_title`, `event_location`, `event_date` properties. | `components/EventCard.tsx` |
| `nav_link_clicked` | User clicks a navigation link in the Navbar. Includes `label` property (Home, Events, Create Event, logo). | `components/Navbar.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/476952/dashboard/1734259)
- [Event Card Clicks Over Time](https://us.posthog.com/project/476952/insights/mlnz8CcN)
- [Explore Events Button Clicks](https://us.posthog.com/project/476952/insights/EYScNPnL)
- [Nav Link Clicks by Label](https://us.posthog.com/project/476952/insights/gFA0WCF5)
- [Unique Users Exploring Events](https://us.posthog.com/project/476952/insights/9kQI4URN)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
