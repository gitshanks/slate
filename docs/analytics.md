# Slate product analytics

Slate uses PostHog for consented product analytics and masked session replay. The browser SDK sends events directly to PostHog, so analytics does not add Vercel Function invocations.

## Set up

1. Create a PostHog Cloud project in the region you want to use.
2. Copy its **Project API key** (the public `phc_…` token, not a personal API key).
3. Add these deployment variables:

   ```dotenv
   NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_...
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
   NEXT_PUBLIC_POSTHOG_UI_HOST=https://us.posthog.com
   PRIVACY_CONTACT_EMAIL=privacy@example.com
   ```

   For an EU project, use `https://eu.i.posthog.com` and `https://eu.posthog.com`.

4. Redeploy. The consent panel appears only when a project token is present.
5. In PostHog, set a retention period that matches the published privacy notice and restrict project access to people who need the data.

## Consent and data boundaries

- PostHog is not initialized until the visitor chooses **Accept analytics**.
- Choosing **Necessary only**, withdrawing consent, Global Privacy Control, or Do Not Track keeps capture off.
- Session replay masks all text and input values. Hidden and file inputs are blocked. Network request headers and bodies, canvas capture, and console logs are excluded.
- IP enrichment and exact device model collection are disabled.
- URLs have query strings and hashes removed. Account names, title IDs, list slugs, profile usernames, and invite tokens in routes are replaced by placeholders.
- Search text, AI prompts, notes, list names, invite values, uploaded file names/content, authentication codes, and raw error messages must never be added as event properties.
- Account email and display name are person properties only after consent. A stable internal owner ID is the PostHog `distinct_id`.
- Use `data-analytics-private` or `ph-no-capture` on any new surface that renders sensitive content.

The user-facing explanation is at `/privacy`. Keep it aligned with the implementation and the PostHog project’s real region and retention settings.

## Event taxonomy

### Automatic foundation

| Event | Meaning | Useful properties |
|---|---|---|
| `$pageview` | A consented route view | `route`, `surface` |
| `$pageleave` | End of a page view | PostHog duration properties |
| `$web_vitals` | Browser performance | Core Web Vitals |
| `$rageclick` | Repeated frustrated clicks | Sanitized route |
| `ui_interaction` | Any link, button, or menu action | `action`, `area`, `element`, `destination`, `route` |
| `ui_control_changed` | Checkbox, radio, range, or select changed | `action`, `area`, `control`, `enabled`, `route` |
| `form_submitted` | Any nonprivate form submitted | `form`, `route` |
| `client_error` | A browser error without its raw message | `error_name`, `fingerprint`, `source`, `route` |

`unlabeled` generic interactions are intentional coverage for newly added UI. Add `data-analytics-action` and `data-analytics-area` when a control becomes important enough to name.

### Accounts and conversion

| Event | Meaning |
|---|---|
| `auth_method_selected` | Email or Google auth started; email records when the code screen is reached |
| `account_session_started` | First identified app session in a browser tab |
| `account_signed_out` | Explicit sign out; identity is reset immediately afterward |
| `onboarding_started` | The first-title taste builder opened; stores only the size of the deck |
| `onboarding_title_decided` | A title was kept or passed; stores choice, position, and media type, never the title or TMDB id |
| `onboarding_completed` | Initial picks were saved; stores only coarse selected/viewed count buckets |
| `onboarding_skipped` | The taste builder was completed without a saved title |
| `profile_updated` | Profile settings saved, without the entered values |
| `profile_avatar_updated` | Avatar saved, with MIME type and coarse size bucket |
| `profile_link_copied` | Public profile link copied |

### Discovery and search

| Event | Meaning |
|---|---|
| `search_opened` | Catalogue or AI search opened |
| `search_started` | Search submitted or results loaded; stores query length and result-count buckets, never query text |
| `ai_prompt_submitted` | AI turn submitted; stores only prompt-length bucket and source |
| `shared_link_resolved` | A recommendation link was resolved; stores host and count buckets, never the URL or extracted text |
| `shared_link_titles_saved` | Selected titles from a recommendation link were processed |
| `trailer_opened` | Title-page trailer opened |

### Library and lists

| Event | Meaning |
|---|---|
| `title_saved` | A title was added, with source, media type, and destination status |
| `title_status_changed` | A saved title moved between states |
| `title_rated` | Sentiment rating set or cleared |
| `title_note_saved` | Private note saved; only a presence flag and length bucket are sent |
| `title_removed` | Title removed from the library |
| `list_created` | List creation submitted; no list name is sent |
| `list_deleted` | Confirmed list deletion submitted |
| `list_title_added` | Title successfully added to a list |
| `list_invite_created` | Invite link successfully created; token is never sent |
| `list_member_removed` | Collaborator removed; identity is never sent |
| `import_completed` | CSV import outcome using coarse count buckets |

### Previews

| Event | Meaning |
|---|---|
| `preview_advanced` | Active trailer changed, including direction and interaction method |
| `preview_info_opened` | Information overlay opened |
| `preview_saved` | Trailer title saved to the library |
| `preview_playback_failed` | Embedded playback failed |
| `preview_session_completed` | Session summary with trailers-seen, duration, and saved-count buckets |

Slate’s existing `preview_feedback` table remains the recommendation-learning source. PostHog events are for aggregate product analysis and do not replace that model.

## Recommended dashboards

### 1. Acquisition to first value

Funnel, converted within 7 days:

1. `$pageview` where `surface = landing`
2. `auth_method_selected`
3. `account_session_started`
4. `title_saved`
5. Any of `title_status_changed`, `title_rated`, `title_note_saved`, or `list_title_added`

Break down by auth method, device type, referring domain, and first `title_saved.source`.

### 2. Discovery quality

- Funnel: `search_opened` → `search_started` with `stage = results_loaded` → `title_saved`
- Funnel: `$pageview` on previews → `preview_advanced` → `preview_info_opened` → `preview_saved`
- Trends: approximate searches, empty result buckets, AI prompts, shared-link failures, trailer failures
- Breakdown saves by `source`, `media_type`, and `status`

### 3. Retention and habit

- Weekly active identified users
- Returning users with `account_session_started`
- Cohorts based on first `title_saved`
- 1, 7, and 30-day retention using any meaningful library or preview event
- Frequency of status changes and ratings after saving

### 4. Collaboration

Funnel:

1. `$pageview` where `surface = lists`
2. `list_created`
3. `list_invite_created`
4. `form_submitted` where `form = shared_list_invite_accept`
5. `list_title_added`

### 5. Friction and reliability

- `client_error` grouped by `fingerprint`, `route`, browser, and app version
- `$rageclick` and repeated `ui_interaction` on the same route
- `preview_playback_failed` by browser/device category
- Core Web Vitals by route and device
- Session replays filtered to the error, rage click, or failed funnel step

## Case-study reporting

Use aggregate or de-identified numbers in public work. Good measures include activation rate, median time to first saved title, search-to-save conversion, preview-to-save conversion, percentage of active users who create or join a shared list, and error-free session rate. Do not publish emails, display names, replay clips, small cohorts that identify a person, or raw notes/search terms.
