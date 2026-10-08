document.addEventListener('DOMContentLoaded', function () {
    const contestSelect = document.getElementById('contestSelect');
    const contestMeta = document.getElementById('contestMeta');
    const previewTitle = document.getElementById('previewTitle');
    const previewDetails = document.getElementById('contestPreviewDetails');
    const pdfPreview = document.getElementById('pdfPreview');
    const pdfFrame = document.getElementById('pdfFrame');
    const contestSubmissionGrid = document.querySelector('.contest-submission-grid');
    const questionList = document.getElementById('questionList');
    const submitButton = document.getElementById('submitButton');
    const submitStatus = document.getElementById('submitStatus');
    const startButton = document.getElementById('startButton');
    const contestEntryGate = document.getElementById('contestEntryGate');
    const enterContestButton = document.getElementById('enterContestButton');
    const entryStatus = document.getElementById('entryStatus');
    const usernameInput = document.getElementById('usernameInput');
    const leaderboardOptIn = document.getElementById('leaderboardOptIn');
    const contestFormFields = document.getElementById('contestFormFields');
    const contestSubmission = document.querySelector('.contest-submission');
    const timerRow = document.getElementById('timerRow');
    const googleSheetEndpoint = 'https://script.google.com/macros/s/AKfycbz5r9feJoby-zg7GIinGFM-3yU8v9IBfF4p6nVRrm4dR0WQnLev1WMSZH69WFblNQRNDA/exec';
    const timerValue = document.getElementById('timerValue');

    let contests = [];
    let selectedContest = null;
    let timerInterval = null;
    let remainingSeconds = 0;
    let timerDeadline = 0;
    let started = false;
    let testVisible = false;
    let submissionFinished = false;
    let submissionId = '';
    let submissionSent = false;
    let submissionInProgress = false;
    let automaticSubmissionStarted = false;
    let startTimestamp = null;
    let totalOutOfTabMs = 0;
    let hiddenSince = null;

    function parseTimeLimit(limit) {
        if (typeof limit === 'number' && !Number.isNaN(limit)) {
            return limit * 60;
        }

        if (typeof limit === 'string') {
            const numeric = limit.match(/(\d+)/);
            return numeric ? Number(numeric[1]) * 60 : 0;
        }

        return 0;
    }

    function formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remaining = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function getOutOfTabSeconds() {
        const currentHiddenMs = hiddenSince ? Date.now() - hiddenSince : 0;
        return Math.floor((totalOutOfTabMs + currentHiddenMs) / 1000);
    }

    function formatContestMeta(contest) {
        const displayedLimit = typeof contest.timeLimit === 'number' ? `${contest.timeLimit} minutes` : contest.timeLimit;
        return `
            <div class="contest-meta-row"><span>Active now:</span><strong>${contest.active ? 'Yes' : 'No'}</strong></div>
            <div class="contest-meta-row"><span>Questions:</span><strong>${contest.questionCount}</strong></div>
            <div class="contest-meta-row"><span>Time limit:</span><strong>${displayedLimit}</strong></div>
        `;
    }

    function buildQuestionFields(count) {
        const fragment = document.createDocumentFragment();

        for (let i = 1; i <= count; i += 1) {
            const block = document.createElement('div');
            block.className = 'question-field';

            const label = document.createElement('label');
            label.setAttribute('for', `answer-${i}`);
            label.textContent = `Question ${i}`;
            label.className = 'question-label';

            const answerInput = document.createElement('input');
            answerInput.id = `answer-${i}`;
            answerInput.name = `answer-${i}`;
            answerInput.type = 'text';
            answerInput.maxLength = 1;
            answerInput.pattern = '[A-Ea-e]';
            answerInput.placeholder = 'A-E';
            answerInput.className = 'text-field answer-input';
            answerInput.addEventListener('input', function () {
                this.value = this.value.replace(/[^A-Ea-e]/g, '').slice(0, 1);
            });

            block.appendChild(label);
            block.appendChild(answerInput);
            fragment.appendChild(block);
        }

        return fragment;
    }

    function getGoogleDrivePreviewUrl(link) {
        const fileIdMatch = link.match(/\/file\/d\/([^\/]+)\//);
        if (fileIdMatch) {
            return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
        }
        const idMatch = link.match(/[?&]id=([^&]+)/);
        if (idMatch) {
            return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
        }
        return link;
    }

    function renderContest(contest) {
        selectedContest = contest;

        if (!contest) {
            previewTitle.textContent = 'Contest Preview';
            previewDetails.innerHTML = '<p class="preview-note">Choose an active contest to see its details and the question fields.</p>';
            pdfFrame.src = '';
            questionList.innerHTML = '';
            contestMeta.innerHTML = '';
            timerRow.classList.add('hidden');
            contestFormFields.classList.add('hidden');
            startButton.disabled = true;
            startButton.classList.remove('hidden');
            return;
        }

        previewTitle.textContent = contest.name;
        contestSubmissionGrid.classList.toggle('is-started', started);
        contestMeta.innerHTML = formatContestMeta(contest);
        previewDetails.innerHTML = `
            <p><strong>${contest.name}</strong></p>
            <p class="contest-status ${contest.active ? 'status-active' : 'status-inactive'}">${contest.active ? 'Currently active' : 'Not active'}</p>
        `;

        if (started && testVisible) {
            pdfFrame.src = getGoogleDrivePreviewUrl(contest.pdfLink);
            pdfPreview.classList.remove('hidden');
        } else {
            pdfFrame.src = '';
            pdfPreview.classList.add('hidden');
        }

        if (!started) {
            questionList.innerHTML = '';
            contestFormFields.classList.add('hidden');
            timerRow.classList.add('hidden');
            const canStartContest = Boolean(contest.active);
            startButton.disabled = !canStartContest;
            startButton.classList.remove('hidden');
            contestSelect.disabled = false;
        } else {
            timerRow.classList.remove('hidden');
            startButton.disabled = true;
            startButton.classList.add('hidden');
            contestSelect.disabled = true;
            if (testVisible) {
                contestEntryGate.classList.add('hidden');
                contestFormFields.classList.remove('hidden');
                if (questionList.childElementCount === 0) {
                    questionList.appendChild(buildQuestionFields(contest.questionCount));
                }
            } else {
                contestEntryGate.classList.remove('hidden');
                contestFormFields.classList.add('hidden');
            }
        }
    }

    function populateContestSelect(items) {
        const activeItems = items.filter((contest) => contest.active);
        contestSelect.innerHTML = activeItems.length > 0
            ? activeItems
                .map((contest) => `<option value="${contest.id}">${contest.name}</option>`)
                .join('')
            : '<option value="">No active contests available</option>';

        if (activeItems.length > 0) {
            renderContest(activeItems[0]);
        } else {
            renderContest(null);
        }
    }

    function beginTimer() {
        timerDeadline = Date.now() + remainingSeconds * 1000;
        timerValue.textContent = formatDuration(remainingSeconds);
        timerRow.classList.remove('hidden');

        timerInterval = setInterval(() => {
            remainingSeconds = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
            timerValue.textContent = formatDuration(remainingSeconds);
            if (remainingSeconds <= 0) {
                expireContest();
                return;
            }
        }, 1000);
    }

    function expireContest() {
        stopTimer();
        remainingSeconds = 0;
        timerValue.textContent = '00:00';
        submitButton.disabled = true;
        enterContestButton.disabled = true;
        Array.from(questionList.querySelectorAll('.answer-input')).forEach((answerInput) => {
            answerInput.disabled = true;
        });
        sendAutomaticSubmission(false);
    }

    function getSubmissionPayload(submissionType = 'manual') {
        const username = document.getElementById('usernameInput').value.trim();
        const answers = Array.from(questionList.querySelectorAll('.answer-input')).map((answerInput, index) => ({
            question: index + 1,
            answer: answerInput.value,
        }));
        const now = Date.now();
        const timeTakenSeconds = startTimestamp ? Math.floor((now - startTimestamp) / 1000) : 0;
        const timeAwaySeconds = getOutOfTabSeconds();

        return {
            contestId: selectedContest?.id || '',
            contestName: selectedContest?.name || '',
            username,
            questionCount: selectedContest?.questionCount || 0,
            timeTakenSeconds,
            timeAwaySeconds,
            timeLimitMinutes: selectedContest?.timeLimit || 0,
            leaderboardOptIn: leaderboardOptIn.value,
            submissionId,
            submissionType,
            answers: JSON.stringify(answers),
            submittedAt: new Date(now).toISOString(),
        };
    }

    function completeSubmission(message) {
        submissionSent = true;
        submissionFinished = true;
        submissionInProgress = false;
        stopTimer();
        started = false;
        testVisible = false;
        usernameInput.disabled = true;
        leaderboardOptIn.disabled = true;
        enterContestButton.disabled = true;
        submitButton.disabled = true;
        questionList.innerHTML = '';
        contestEntryGate.classList.add('hidden');
        contestFormFields.classList.add('hidden');
        timerRow.classList.add('hidden');
        pdfFrame.src = '';
        pdfPreview.classList.add('hidden');
        contestSubmissionGrid.classList.remove('is-started');
        contestSubmission.classList.remove('is-started');
        contestSelect.disabled = true;
        startButton.disabled = true;
        startButton.classList.remove('hidden');
        previewTitle.textContent = 'Submission received';
        const notice = document.createElement('p');
        notice.className = 'preview-note';
        notice.textContent = message;
        previewDetails.replaceChildren(notice);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }

    function sendAutomaticSubmission(preferBeacon) {
        if (!started || submissionSent || automaticSubmissionStarted) {
            return;
        }

        automaticSubmissionStarted = true;
        const payload = getSubmissionPayload('automatic');
        const answers = JSON.parse(payload.answers);
        payload.answers = JSON.stringify((answers.length > 0 ? answers : Array.from({ length: payload.questionCount }, (_, index) => ({
            question: index + 1,
            answer: '',
        }))).map(({ question, answer }) => ({
            question,
            answer: /^[A-Ea-e]$/.test(answer) ? answer : '',
        })));
        const body = JSON.stringify(payload);
        const statusTarget = testVisible ? submitStatus : entryStatus;
        const queuedMessage = 'Automatic submission sent; this browser cannot verify Google received it.';
        statusTarget.textContent = preferBeacon
            ? 'Sending automatic submission before the page closes.'
            : 'Time is up. Sending your answers automatically.';
        statusTarget.style.color = 'rgb(55, 65, 81)';

        if (preferBeacon) {
            const queued = navigator.sendBeacon(
                googleSheetEndpoint,
                new Blob([body], { type: 'text/plain;charset=UTF-8' }),
            );
            if (queued) {
                if (document.visibilityState !== 'hidden') {
                    completeSubmission(queuedMessage);
                } else {
                    submissionSent = true;
                }
                return;
            }
        }

        fetch(googleSheetEndpoint, {
            method: 'POST',
            mode: 'no-cors',
            keepalive: true,
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body,
        }).then(() => {
            completeSubmission(queuedMessage);
        }).catch(() => {
            if (navigator.sendBeacon(googleSheetEndpoint, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) {
                if (document.visibilityState !== 'hidden') {
                    completeSubmission(queuedMessage);
                } else {
                    submissionSent = true;
                }
                return;
            }
            automaticSubmissionStarted = false;
            statusTarget.textContent = 'Automatic submission could not be sent. Check your connection before leaving this page.';
            statusTarget.style.color = 'rgb(220, 38, 38)';
        });
    }

    async function submitToGoogleSheet() {
        if (!selectedContest || !selectedContest.active) {
            submitStatus.textContent = 'Only active contests can be submitted.';
            submitStatus.style.color = 'rgb(220, 38, 38)';
            submitButton.disabled = true;
            return;
        }

        const payload = getSubmissionPayload();
        const invalidAnswer = Array.from(questionList.querySelectorAll('.answer-input'))
            .find((answerInput) => answerInput.value !== '' && !/^[A-Ea-e]$/.test(answerInput.value));
        if (invalidAnswer) {
            submitStatus.textContent = 'Each answer must be one letter: A, B, C, D, E, or lowercase.';
            submitStatus.style.color = 'rgb(220, 38, 38)';
            submitButton.disabled = false;
            invalidAnswer.focus();
            return;
        }

        submitButton.disabled = true;
        submitStatus.textContent = 'Submitting...';
        submitStatus.style.color = 'rgb(55, 65, 81)';
        submissionInProgress = true;
        try {
            const response = await fetch(googleSheetEndpoint, {
                method: 'POST',
                mode: 'no-cors',
                keepalive: true,
                headers: {
                    'Content-Type': 'text/plain;charset=UTF-8',
                },
                body: JSON.stringify(payload),
            });

            if (response.type === 'opaque') {
                completeSubmission('Submission request sent. This browser cannot confirm whether Google recorded it.');
                return;
            }

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (_) {
                result = { result: text };
            }

            if (!response.ok) {
                throw new Error(`Submission failed (${response.status}): ${result.result || response.statusText}`);
            }

            completeSubmission(result.result || 'Submission successful.');
        } catch (error) {
            submissionInProgress = false;
            submitStatus.textContent = `Submission failed: ${error.message}`;
            submitStatus.style.color = 'rgb(220, 38, 38)';
            submitButton.disabled = remainingSeconds <= 0;
            console.error('Submission error:', error);
        }
    }

    function handleVisibilityChange() {
        if (!started) {
            return;
        }

        if (document.visibilityState === 'visible' && timerDeadline && Date.now() >= timerDeadline) {
            expireContest();
        }

        if (document.visibilityState === 'hidden' && !hiddenSince) {
            hiddenSince = Date.now();
            return;
        }

        if (document.visibilityState === 'visible' && hiddenSince) {
            totalOutOfTabMs += Date.now() - hiddenSince;
            hiddenSince = null;
        }
    }

    function startContest() {
        if (submissionFinished || !selectedContest || !selectedContest.active) {
            submitStatus.textContent = 'Only active contests can be started.';
            return;
        }

        remainingSeconds = parseTimeLimit(selectedContest.timeLimit);
        if (remainingSeconds <= 0) {
            submitStatus.textContent = 'Unable to start contest because its time limit is invalid.';
            return;
        }

        started = true;
        testVisible = false;
        submissionFinished = false;
        submissionSent = false;
        submissionInProgress = false;
        automaticSubmissionStarted = false;
        submissionId = crypto.randomUUID();
        startTimestamp = Date.now();
        totalOutOfTabMs = 0;
        hiddenSince = null;
        contestEntryGate.classList.remove('hidden');
        entryStatus.textContent = '';
        contestSelect.disabled = true;
        startButton.disabled = true;
        startButton.classList.add('hidden');

        contestSubmissionGrid.classList.add('is-started');
        contestSubmission.classList.add('is-started');
        pdfFrame.src = '';
        pdfPreview.classList.add('hidden');
        beginTimer();
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    function enterContest() {
        if (!usernameInput.value.trim()) {
            entryStatus.textContent = 'Enter your AoPS username to continue.';
            usernameInput.focus();
            return;
        }
        if (!['Yes', 'No'].includes(leaderboardOptIn.value)) {
            entryStatus.textContent = 'Choose Yes or No for leaderboard inclusion.';
            leaderboardOptIn.focus();
            return;
        }

        testVisible = true;
        contestEntryGate.classList.add('hidden');
        contestFormFields.classList.remove('hidden');
        pdfFrame.src = `${getGoogleDrivePreviewUrl(selectedContest.pdfLink)}?rm=minimal`;
        pdfPreview.classList.remove('hidden');
        if (questionList.childElementCount === 0) {
            questionList.appendChild(buildQuestionFields(selectedContest.questionCount));
        }
        submitButton.disabled = false;
    }

    function submitOnPageHide() {
        sendAutomaticSubmission(true);
    }

    startButton.addEventListener('click', startContest);
    enterContestButton.addEventListener('click', enterContest);
    usernameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            enterContest();
        }
    });
    window.addEventListener('pagehide', submitOnPageHide);

    fetch('./assets/data/contests.json')
        .then((response) => {
            if (!response.ok) {
                throw new Error('Failed to load contests.json');
            }
            return response.json();
        })
        .then((data) => {
            contests = Array.isArray(data) ? data : [];
            if (contests.length === 0) {
                contestSelect.innerHTML = '<option value="">No contests available</option>';
                renderContest(null);
                return;
            }
            populateContestSelect(contests);
        })
        .catch((error) => {
            contestSelect.innerHTML = '<option value="">Unable to load contests</option>';
            console.error(error);
            renderContest(null);
        });

    contestSelect.addEventListener('change', function () {
        const selected = contests.find((contest) => contest.id === this.value && contest.active);
        renderContest(selected || null);
    });

    submitButton.addEventListener('click', submitToGoogleSheet);
});
