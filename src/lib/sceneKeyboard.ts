const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [contenteditable="true"]';

/**
 * Keep Enter and Space native when an interactive control owns the event.
 * The canvas and page body still act as the scene's keyboard surface.
 */
export function shouldHandleSceneShortcut(target: EventTarget | null) {
  const element = target as
    | (EventTarget & { closest?: (selector: string) => Element | null })
    | null;
  return !element?.closest?.(INTERACTIVE_SELECTOR);
}
