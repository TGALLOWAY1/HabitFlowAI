export interface NumericPopoverViewport {
    width: number;
    height: number;
    offsetLeft?: number;
    offsetTop?: number;
}

const POPOVER_WIDTH = 192;
const POPOVER_HEIGHT = 64;
const VIEWPORT_GUTTER = 8;

/** Keep the fixed quantity popover fully inside the visual viewport. */
export function getSafeNumericPopoverPosition(
    position: { top: number; left: number },
    viewport: NumericPopoverViewport,
): { top: number; left: number } {
    const viewportLeft = viewport.offsetLeft ?? 0;
    const viewportTop = viewport.offsetTop ?? 0;
    const minLeft = viewportLeft + VIEWPORT_GUTTER;
    const minTop = viewportTop + VIEWPORT_GUTTER;
    const maxLeft = Math.max(minLeft, viewportLeft + viewport.width - POPOVER_WIDTH - VIEWPORT_GUTTER);
    const maxTop = Math.max(minTop, viewportTop + viewport.height - POPOVER_HEIGHT - VIEWPORT_GUTTER);

    return {
        left: Math.min(Math.max(position.left, minLeft), maxLeft),
        top: Math.min(Math.max(position.top, minTop), maxTop),
    };
}
