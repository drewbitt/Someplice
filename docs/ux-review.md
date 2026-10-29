# Goals and daily intentions: interaction review

Reviewed on 2026-10-29. Scope: goal creation/editing, control feedback, current-intention presentation, and closely related accessibility and save-state behavior.

## Behavior decisions and sources

### MDN pass: use native controls

Goal creation is a native form with a submit button. This preserves browser validation and Enter submission without another custom keyboard submission handler. Cancel and color-picker controls use `type="button"`. MDN documents these distinctions in [button behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button) and the [submit event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit_event).

The editor uses one disabled fieldset while an existing-goal save is pending. This prevents changes after the submitted snapshot was taken and covers nested title, description, palette and lifecycle buttons together. This follows [fieldset disabled behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/fieldset).

The palette retains the native modal dialog's focus containment and Escape dismissal. The inline draft's Escape handler ignores open dialogs, handled events and text composition. [MDN's dialog documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) describes native dismissal; [keyboard-event guidance](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event) explains composition events. Native form submission also avoids the custom Enter/IME pitfalls described by [Chrome's form guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/forms/ime-safe-enter-submit).

### Product pass: explicit creation and a visible current item

New Goal opens a local draft and focuses its title. Create goal or Enter commits it. Cancel/Escape dismisses it without creating a goal or history. Description is optional and a distinct color is preselected. A failed request keeps the draft available; a successful write followed by a failed refresh closes it and explains how to see the saved goal, preventing a duplicate retry.

This is a product judgment for this short form, informed by the existing explicit Save convention and [NN/g's user-control guidance](https://www.nngroup.com/articles/user-control-and-freedom/). It is not a claim that explicit saving is universally better than autosave. No extra confirmation dialog is added to starting or canceling a short draft.

Today emphasizes its first pending intention belonging to an active goal. Completion, deferral and reordering update that cue. Size, weight, a tinted background and an edge marker communicate the distinction without relying only on color. The [Intend feature reference](https://intend.do/features) and supplied screenshots informed this presentation. Intend's separate Now workflow returns to an open choice after completion; Today continues to present its ordered daily list.

### Svelte and upstream GitHub pass: reduce custom state and handlers

- Replaced the pseudo-button on intention text with a native button. Pointer, Enter and Space activation share one status-update function with the checkbox; failures restore the checkbox and retain the prior status.
- Removed the custom Space activation handler and global drag-key override. The installed library already ignores nested native controls, while rows retain its normal keyboard dragging behavior. Verified against the [upstream documentation and source](https://github.com/isaacHagoel/svelte-dnd-action). Svelte's [event-delegation guidance](https://svelte.dev/docs/svelte/svelte-events) also argues against relying on extra propagation handlers around action-installed listeners.
- Removed two derived aliases that simply repeated existing booleans.
- Moved palette fetching to its open event; retained the effect that synchronizes the native dialog. Svelte recommends event handlers and derived values over unnecessary state-synchronizing effects in its [$effect guidance](https://svelte.dev/docs/svelte/$effect).
- Used [$props.id()](<https://svelte.dev/docs/svelte/$props#props.id()>) for the palette's accessible heading association, including SSR/hydration consistency.
- Shared one goal-edit field style and extracted repeated E2E goal-creation setup. Larger form or mutation frameworks would add complexity without helping this change.

### Tailwind and accessibility pass

The mobile layout uses the available title width and wraps long titles/descriptions. The card can grow instead of clipping a fixed-height row. Desktop enhancements use ordinary breakpoints, following [Tailwind's mobile-first model](https://tailwindcss.com/docs/responsive-design). Keyboard focus remains visible using [focus-state variants](https://tailwindcss.com/docs/hover-focus-and-other-states).

Intention menus remain visible on touch screens and have 32×32 CSS-pixel targets. Intention text is also an activation target. This exceeds the ordinary 24×24 minimum described by [W3C's target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Text shades preserve goal hue while adjusting lightness for the current theme; deferred items use a minus prefix and italics instead of whole-row opacity. The current-intention palette sweep measured a minimum 5.04:1 text contrast across 19 colors and both themes. [W3C's contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) describes the normal-text 4.5:1 threshold.

## Additional findings fixed

| Finding                                                                                           | Severity | Resolution                                                                       |
| ------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| Long titles were clipped to half the details column and two lines on phones                       | Medium   | Use full width and wrapping; allow the card to grow                              |
| Goals/Today list sections used an unsupported role combination; inactive list IDs were duplicated | Low      | Use compatible list containers and distinct IDs; omit the empty inactive section |
| Intention text announced a button but pointer activation did nothing                              | Medium   | Native toggle button with shared status update                                   |
| Today lacked an h1; Goals included toolbar controls inside its h1                                 | Low      | Add a screen-reader Today heading and separate Goals heading from toolbar        |
| Typing during an existing-goal save silently discarded the later edit                             | Medium   | Disable the editor while saving; re-enable and preserve the draft on failure     |
| Deferred-row opacity reduced text contrast to 2.58:1                                              | Medium   | Preserve readable text; retain semantic status prefixes and italics              |

The palette also keeps the edited goal's original color available while excluding colors used by other goals. Its dialog has an accessible name, and goal descriptions have explicit programmatic labels.

## Verification approach

The regression suite checks user-visible outcomes: absence of writes after cancellation, focus movement, retry after rejection, one in-flight submission, disabled controls during save, original-color selection, current-item progression, and native pointer/keyboard activation. It uses controlled promises for pending/error states rather than timing sleeps.

Component browser tests exercise native focus, fieldset disabling, dialog Escape behavior and DOM updates in Chromium, Firefox and WebKit. The end-to-end suite checks persisted results against the real server and SQLite database, including keyboard reordering across reload. Reordering waits for its server response before reload, avoiding a test that observes the local move and then cancels its pending request. This matches [Playwright's user-facing locator and assertion guidance](https://playwright.dev/docs/best-practices) and [Vitest's real-browser interaction API](https://vitest.dev/api/browser/interactivity).

Direct agent-browser checks covered phone-width layout, both themes, native activation, completion/deferral, creation failure/retry, a controlled slow save, nested Escape dismissal, and accessibility scans. The final sampled Goals and settled light/dark Today states had zero automated accessibility violations. Scanner incomplete results still require judgment; this is not a comprehensive accessibility certification. Screenshots, recordings and raw audit results are supplied separately with the local review report.

## Limits and follow-ups

- Someplice's existing active-goal limit is nine; Intend's reference describes ten. This pass retains the current cap. Raising it should include a review of numbered-intention parsing and ordering, rather than changing only the API constant.
- A separate Now page, per-goal sharing/privacy and new priority workflows require their own product scope.
- Phone-width browser checks do not replace physical touch-device testing. Composition protection has a synthetic regression test; a physical CJK IME was not exercised.
- UI single-flight guards prevent accidental repeated submissions. A connection lost after the server commits but before the client receives its response would require server-side idempotency for a stronger duplicate-creation guarantee.
