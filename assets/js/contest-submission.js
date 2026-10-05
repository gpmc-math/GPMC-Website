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
    const contestFormFields = document.getElementById('contestFormFields');
    const contestSubmission = document.querySelector('.contest-submission');
    const timerRow = document.getElementById('timerRow');
    const googleSheetEndpoint = 'https://script.google.com/macros/s/AKfycbxgG9PCYA_1PgKmnVBQuOG_pckFJGX75SRzMN9xS9_nNbtcvYBwYkaHyLDC6ugz-H6W-g/exec';
    const timerValue = document.getElementById('timerValue');
    const modalOverlay = document.getElementById('startModalOverlay');
    const modalTimeLimit = document.getElementById('modalTimeLimit');
    const confirmStartButton = document.getElementById('confirmStartButton');
    const cancelStartButton = document.getElementById('cancelStartButton');

    let contests = [];
    let selectedContest = null;
    let timerInterval = null;
    let remainingSeconds = 0;
    let started = false;
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

    function openModal(modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    function closeModal(modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
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
            answerInput.inputMode = 'numeric';
            answerInput.maxLength = 3;
            answerInput.minLength = 3;
            answerInput.pattern = '[0-9]{3}';
            answerInput.required = true;
            answerInput.placeholder = 'Enter an answer between 000-999.';
            answerInput.className = 'text-field answer-input';
            answerInput.addEventListener('input', function () {
                this.value = this.value.replace(/[^0-9]/g, '').slice(0, 3);
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

        if (started) {
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
            contestFormFields.classList.remove('hidden');
            timerRow.classList.remove('hidden');
            startButton.disabled = true;
            startButton.classList.add('hidden');
            contestSelect.disabled = true;
            if (questionList.childElementCount === 0) {
                questionList.appendChild(buildQuestionFields(contest.questionCount));
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
        timerValue.textContent = formatDuration(remainingSeconds);
        timerRow.classList.remove('hidden');

        timerInterval = setInterval(() => {
            remainingSeconds -= 1;
            if (remainingSeconds <= 0) {
                stopTimer();
                timerValue.textContent = '00:00';
                alert('Time is up! The contest has ended.');
                return;
            }
            timerValue.textContent = formatDuration(remainingSeconds);
        }, 1000);
    }

    function getSubmissionPayload() {
        const username = document.getElementById('usernameInput').value.trim();
        const answers = Array.from(questionList.querySelectorAll('.answer-input')).map((answerInput, index) => ({
            question: index + 1,
            answer: answerInput.value.trim(),
        }));
        const now = Date.now();
        const timeTakenSeconds = startTimestamp ? Math.floor((now - startTimestamp) / 1000) : 0;
        const timeAwaySeconds = getOutOfTabSeconds();

        return {
            contestId: selectedContest?.id || '',
            contestName: selectedContest?.name || '',
            username,
            timeTakenSeconds,
            timeAwaySeconds,
            timeLimitMinutes: selectedContest?.timeLimit || 0,
            answers: JSON.stringify(answers),
            submittedAt: new Date(now).toISOString(),
        };
    }

    async function submitToGoogleSheet() {
        if (!selectedContest || !selectedContest.active) {
            submitStatus.textContent = 'Only active contests can be submitted.';
            submitStatus.style.color = 'rgb(220, 38, 38)';
            submitButton.disabled = true;
            return;
        }

        submitButton.disabled = true;
        submitStatus.textContent = 'Submitting...';
        submitStatus.style.color = 'rgb(55, 65, 81)';

        const payload = getSubmissionPayload();
        if (!payload.username) {
            submitStatus.textContent = 'Please enter your AoPS username before submitting.';
            submitStatus.style.color = 'rgb(220, 38, 38)';
            submitButton.disabled = false;
            return;
        }

        const invalidAnswer = Array.from(questionList.querySelectorAll('.answer-input'))
            .find((answerInput) => !/^[0-9]{3}$/.test(answerInput.value));
        if (invalidAnswer) {
            submitStatus.textContent = 'Each answer must contain exactly 3 digits.';
            submitStatus.style.color = 'rgb(220, 38, 38)';
            submitButton.disabled = false;
            invalidAnswer.focus();
            return;
        }

        try {
            const response = await fetch(googleSheetEndpoint, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'text/plain;charset=UTF-8',
                },
                body: JSON.stringify(payload),
            });

            if (response.type === 'opaque') {
                submitStatus.textContent = 'Submission sent. Response is opaque due to CORS.';
                submitStatus.style.color = 'rgb(16, 185, 129)';
                submitButton.disabled = true;
                document.getElementById('usernameInput').disabled = true;
                Array.from(questionList.querySelectorAll('.answer-input')).forEach((answerInput) => {
                    answerInput.disabled = true;
                });
                contestFormFields.classList.add('hidden');
                timerRow.classList.add('hidden');
                contestSubmissionGrid.classList.remove('is-started');
                contestSubmission.classList.remove('is-started');
                previewTitle.textContent = 'Contest completed';
                previewDetails.innerHTML = '<p class="preview-note">Contest completed; submission recorded.</p>';
                document.removeEventListener('visibilitychange', handleVisibilityChange);
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

            submitStatus.textContent = result.result || 'Submission successful!';
            submitStatus.style.color = 'rgb(16, 185, 129)';
            submitButton.disabled = true;
            document.getElementById('usernameInput').disabled = true;
            Array.from(questionList.querySelectorAll('.answer-input')).forEach((answerInput) => {
                answerInput.disabled = true;
            });
            contestFormFields.classList.add('hidden');
            timerRow.classList.add('hidden');
            contestSubmissionGrid.classList.remove('is-started');
            contestSubmission.classList.remove('is-started');
            previewTitle.textContent = 'Contest completed';
            previewDetails.innerHTML = '<p class="preview-note">Contest completed; submission recorded.</p>';
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        } catch (error) {
            submitStatus.textContent = `Submission failed: ${error.message}`;
            submitStatus.style.color = 'rgb(220, 38, 38)';
            submitButton.disabled = false;
            console.error('Submission error:', error);
        }
    }

    function handleVisibilityChange() {
        if (!started) {
            return;
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

    startButton.addEventListener('click', function () {
        if (!selectedContest) {
            alert('Please choose an active contest first.');
            return;
        }

        if (!selectedContest.active) {
            alert('That contest is not active right now. Please choose an active contest.');
            return;
        }

        const displayLimit = typeof selectedContest.timeLimit === 'number'
            ? `${selectedContest.timeLimit} minutes`
            : selectedContest.timeLimit;
        modalTimeLimit.textContent = displayLimit;
        openModal(modalOverlay);
    });

    cancelStartButton.addEventListener('click', function () {
        closeModal(modalOverlay);
    });

    confirmStartButton.addEventListener('click', function () {
        closeModal(modalOverlay);

        if (!selectedContest || !selectedContest.active) {
            alert('Only active contests can be started.');
            return;
        }

        started = true;
        startTimestamp = Date.now();
        totalOutOfTabMs = 0;
        hiddenSince = null;
        remainingSeconds = parseTimeLimit(selectedContest.timeLimit);

        if (remainingSeconds <= 0) {
            alert('Unable to start contest. Invalid time limit.');
            return;
        }

        contestFormFields.classList.remove('hidden');
        contestSelect.disabled = true;
        startButton.disabled = true;
        startButton.classList.add('hidden');

        contestSubmissionGrid.classList.add('is-started');
        contestSubmission.classList.add('is-started');
        pdfFrame.src = `${getGoogleDrivePreviewUrl(selectedContest.pdfLink)}?rm=minimal`;
        pdfPreview.classList.remove('hidden');

        if (questionList.childElementCount === 0) {
            questionList.appendChild(buildQuestionFields(selectedContest.questionCount));
        }

        submitButton.disabled = false;
        submitButton.classList.remove('hidden');

        beginTimer();
        document.addEventListener('visibilitychange', handleVisibilityChange);
    });

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
