const SPREADSHEET_ID = '1mzk-8Cufgv0e4AjdKiUSSuFRLED5HPImNDjPMiKcEJU';
const SHEET_NAME = 'Submissions';
const GOOGLE_OAUTH_CLIENT_ID = '77450154299-8qgioq80vpjiv7vpf6s9tvg1ogbbihct.apps.googleusercontent.com';
const HEADERS = [
  'Submitted At (UTC)',
  'Contest ID',
  'Contest Name',
  'AoPS Username',
  'Time Taken (Seconds)',
  'Time Away (Seconds)',
  'Time Limit (Minutes)',
  'Answers (JSON)',
  'Leaderboard Opt-In',
  'Google Account Email',
];

function doGet() {
  return jsonResponse({ status: 'ready' });
}

function doPost(e) {
  let payload;
  try {
    const body = e && e.postData && e.postData.contents;
    if (!body) {
      throw new Error('Request body is empty');
    }
    payload = JSON.parse(body);
  } catch (error) {
    Logger.log('Rejected submission: %s', error.message);
    return jsonResponse({ error: error.message || 'Invalid JSON payload' });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return jsonResponse({ error: 'Payload must be an object' });
  }
  if (!String(payload.username || '').trim()) {
    return jsonResponse({ error: 'AoPS username is required' });
  }
  if (typeof payload.googleIdToken !== 'string' || !payload.googleIdToken) {
    return jsonResponse({ error: 'Google sign-in is required' });
  }
  if (!['Yes', 'No'].includes(payload.leaderboardOptIn)) {
    return jsonResponse({ error: 'Leaderboard choice must be Yes or No' });
  }

  const googleIdentity = verifyGoogleIdToken(payload.googleIdToken);
  if (!googleIdentity.verified) {
    Logger.log('Rejected submission: Google identity verification failed: %s', googleIdentity.error);
    return jsonResponse({ error: googleIdentity.error });
  }

  let answers;
  try {
    answers = typeof payload.answers === 'string' ? JSON.parse(payload.answers) : payload.answers;
  } catch (error) {
    return jsonResponse({ error: 'Answers must be valid JSON' });
  }
  if (!Array.isArray(answers)) {
    return jsonResponse({ error: 'Answers must be an array' });
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ error: `Sheet "${SHEET_NAME}" not found` });
  }

  try {
    ensureHeaders(sheet);
    sheet.appendRow([
      new Date().toISOString(),
      payload.contestId || '',
      payload.contestName || '',
      String(payload.username).trim(),
      numberOrZero(payload.timeTakenSeconds),
      numberOrZero(payload.timeAwaySeconds),
      numberOrZero(payload.timeLimitMinutes),
      JSON.stringify(answers),
      payload.leaderboardOptIn,
      googleIdentity.email,
    ]);
    Logger.log('Submission appended to row %s', sheet.getLastRow());
    return jsonResponse({ result: 'Submission successful' });
  } catch (error) {
    Logger.log('Submission write failed: %s', error.stack || error.message);
    return jsonResponse({ error: 'Unable to record submission', details: error.message });
  }
}

function verifyGoogleIdToken(idToken) {
  try {
    const response = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true },
    );
    if (response.getResponseCode() !== 200) {
      return { verified: false, error: 'Google could not verify the signed-in account' };
    }

    const claims = JSON.parse(response.getContentText());
    const issuerValid = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
    if (claims.aud !== GOOGLE_OAUTH_CLIENT_ID || !issuerValid || !emailVerified || !claims.email) {
      return { verified: false, error: 'Google account verification failed' };
    }
    return { verified: true, email: String(claims.email).toLowerCase() };
  } catch (error) {
    Logger.log('Google ID token verification failed: %s', error.message);
    return { verified: false, error: 'Google account verification is temporarily unavailable' };
  }
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  HEADERS.forEach((header, index) => {
    const cell = sheet.getRange(1, index + 1);
    if (!String(cell.getValue() || '').trim()) {
      cell.setValue(header);
    }
  });
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
