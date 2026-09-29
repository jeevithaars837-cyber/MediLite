export const strings = {
  app: {
    title: 'CareSync',
    tagline: 'Healthcare that works even when the network doesn\'t.',
    lowDataMode: 'Low Data Mode',
    lowDataModeDesc: 'Saves bandwidth, disables animations, loads smaller images & reduces polling.',
  },
  status: {
    queued: '✓ Saved on this device — waiting for network',
    syncing: '⟳ Sending…',
    retry_scheduled: '! Couldn\'t send yet — will retry automatically',
    needs_login: '! Sign in again to send (your data is safe)',
    failed_permanent: '! This needs a small change before it can be sent — [Edit]',
    submitted: '✓ Sent — waiting for a doctor',
    doctor_reviewing: 'A doctor is reviewing your request',
    doctor_replied: 'Doctor replied',
    completed: 'Completed',
  },
  errors: {
    offlineAtSubmit: 'Saved on this device. We\'ll send it automatically when you\'re back online.',
    transientSyncFailure: 'We couldn\'t send this yet. Your information is safe on this device and we\'ll retry automatically.',
    localSaveFailed: 'We couldn\'t save this on your device (storage may be full). Nothing was lost from the form — try removing a photo.',
    invalidImage: 'That file doesn\'t look like a photo we can use. Please choose a JPG, PNG or WebP image.',
    imageTooLarge: 'That photo is very large (over 25 MB). Try a different one or take a new picture.',
    sessionExpired: 'Please sign in again to send your consultation. Your data is still saved.',
    doctorAlreadyClaimed: 'Another doctor already started this case.',
    generic: 'Something went wrong. Please try again in a moment.',
  },
  safety: {
    disclaimer: 'CareSync provides communication and consultation support. It does not replace professional medical diagnosis or emergency medical care.',
    emergencyBanner: 'If you believe this is an emergency, contact your local emergency medical service or visit the nearest emergency facility immediately. Do not wait for an online response.',
    priorityLabel: 'Priority suggestion — final assessment must be made by a qualified healthcare professional.',
    inPersonRecommendation: 'The doctor recommends in-person care for this consultation. Please visit a local clinic or hospital as soon as you can.',
  },
  doctor: {
    startReview: 'Start review',
    sendGuidance: 'Send guidance',
    askFollowUp: 'Ask follow-up question',
    recommendInPerson: 'Recommend in-person care',
    markCompleted: 'Mark completed',
    claimedByOther: 'Claimed by another doctor',
  }
};
