<script>
  /**
   * A modal dialog that a keyboard can actually operate: focus moves in on
   * open, Tab is contained, Escape closes from anywhere, and focus returns to
   * whatever opened it.
   *
   * The Escape part matters more than it looks. Binding onkeydown to the
   * overlay only works if focus is already inside the overlay — and if nothing
   * moved focus there, the key event is dispatched at the element that opened
   * the dialog, outside it, so Escape silently does nothing. Listening on the
   * window and moving focus in on open are two halves of the same fix.
   */
  import { focusableIn, nextFocusIndex } from '$lib/focus-trap.js';

  let {
    open = $bindable(false),
    /** Names the dialog. Ignored when `labelledBy` is given. */
    title = '',
    /** Id of a heading inside the dialog that names it. Preferred over title. */
    labelledBy = null,
    /** Clicking the backdrop closes, as most users expect. */
    closeOnBackdrop = true,
    /** Extra class on the dialog box, so callers keep their own sizing. */
    dialogClass = '',
    onclose = null,
    children,
  } = $props();

  let dialogClasses = $derived(['modal-dialog', dialogClass].filter(Boolean).join(' '));

  let dialogRef = $state(null);
  let restoreTo = null;

  function close() {
    open = false;
    onclose?.();
  }

  // Move focus in on open, and put it back where it came from on close.
  $effect(() => {
    if (!open || !dialogRef) return;

    restoreTo = document.activeElement;
    const focusables = focusableIn(dialogRef);
    (focusables[0] || dialogRef).focus();

    // The page behind a modal should not scroll under it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      // Only restore if focus is still inside the dialog we are closing;
      // otherwise the user has already moved on and we would yank them back.
      if (restoreTo?.isConnected && (!document.activeElement || dialogRef?.contains(document.activeElement))) {
        restoreTo.focus();
      }
      restoreTo = null;
    };
  });

  function onWindowKeydown(e) {
    if (!open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }

    if (e.key !== 'Tab' || !dialogRef) return;

    const focusables = focusableIn(dialogRef);
    if (focusables.length === 0) {
      // Nothing to tab to — keep focus on the dialog rather than losing it.
      e.preventDefault();
      dialogRef.focus();
      return;
    }

    const current = focusables.indexOf(document.activeElement);
    const next = nextFocusIndex(focusables.length, current, e.shiftKey);
    e.preventDefault();
    focusables[next].focus();
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if open}
  <!-- The backdrop is a click target only; keyboard users close with Escape,
       handled on the window above, so it needs no role or handler of its own. -->
  <div
    class="modal-backdrop"
    onclick={closeOnBackdrop ? close : null}
    role="presentation"
  ></div>

  <div
    class={dialogClasses}
    bind:this={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-label={labelledBy ? undefined : title}
    aria-labelledby={labelledBy}
    tabindex="-1"
  >
    {@render children?.()}
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1000;
  }

  .modal-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1001;
    max-height: calc(100vh - 2rem);
    width: min(560px, calc(100vw - 2rem));
    overflow-y: auto;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 1.5rem;
    outline: none;
  }

  .modal-dialog:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .modal-dialog {
      animation: modal-in 0.15s ease-out;
    }
  }

  @keyframes modal-in {
    from { opacity: 0; transform: translate(-50%, -48%); }
    to { opacity: 1; transform: translate(-50%, -50%); }
  }
</style>
