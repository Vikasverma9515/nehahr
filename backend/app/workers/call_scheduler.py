"""Background worker: triggers scheduled calls.

Runs every 5 minutes. Checks for:
- Candidates queued for screening calls
- Scheduled reminder calls (2hrs before interview)
- Engagement check-in calls for long-notice candidates
- Dropout detection calls (48hrs post-offer, no response)
"""

# TODO: Implement with APScheduler or similar
# This worker will be started alongside the FastAPI app
