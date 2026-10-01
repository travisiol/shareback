/**
 * The service commitment shown to users. This is a promise the operator has
 * to keep: someone must work the /admin queue within the review window, and
 * rewards must actually be funded and sent after approval.
 */
export const REVIEW_WINDOW_HOURS = 2;
export const SERVICE_START_LABEL = "October 1, 2026";

export const REVIEW_PROMISE = `Every receipt submitted from ${SERVICE_START_LABEL} is reviewed within ${REVIEW_WINDOW_HOURS} hours.`;
export const REWARD_PROMISE = "Rewards are sent right after approval.";
