/**
 * Google Meet UI hooks. Meet changes its DOM without notice, so every hook
 * has several fallbacks and matches on accessible names, not CSS classes.
 * The nightly smoke test (see README) catches breakage early.
 */
export const MEET = {
  nameInput: [
    'input[aria-label="Your name"]',
    'input[placeholder="Your name"]',
    'input[type="text"][jsname]',
  ],
  joinButtons: [/^Ask to join$/i, /^Join now$/i, /^Join$/i, /^Switch here$/i],
  dismissButtons: [/^Got it$/i, /^Dismiss$/i, /^Continue without microphone and camera$/i, /^Close$/i],
  turnOnMic: '[aria-label*="Turn on microphone" i]',
  turnOnCam: '[aria-label*="Turn on camera" i]',
  inCall: ['[aria-label*="Leave call" i]', 'button[aria-label*="leave" i]'],
  captionsOn: '[aria-label*="Turn on captions" i]',
  captionsRegion: '[aria-label="Captions" i], div[jsname="dsyhDe"]',
  // Text Meet shows when the bot can't get in or is removed.
  deniedText: [
    /You can't join this video call/i,
    /Someone in the call denied your request/i,
    /No one responded to your request/i,
    /You've been removed from the meeting/i,
    /This meeting has ended/i,
    /Return to home screen/i,
  ],
  aloneText: [/You're the only one here/i, /No one else is here/i],
} as const;
