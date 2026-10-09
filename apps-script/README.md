# Google Sign-In and Sheets Submission

The contest page requires Google sign-in and an AoPS username before showing the test. Apps Script verifies the Google ID token and stores the verified email in column J.

Create or use the Google OAuth **Web application** client whose ID is configured in both `assets/js/contest-submission.js` and `Code.gs`. Add the exact website origin to its authorized JavaScript origins (for local testing, for example `http://127.0.0.1:5500`). The client ID is public; do not add a client secret to the site.

Replace the code in the Apps Script project with `Code.gs`, run it once to grant external request and spreadsheet permissions, then deploy a **New version** as a web app that executes as you and is accessible to anyone. Keep `googleSheetEndpoint` in the page script set to that deployment's `/exec` URL.

Rows contain timestamp, contest ID, contest name, AoPS username, active time, away time, time limit, answers JSON, leaderboard opt-in, and verified Google email. The script creates missing headers without replacing existing ones. It returns JSON through `ContentService`; do not add `.setHeader()` because Apps Script `TextOutput` does not support it.
