/**
 * Conversation Funnel Builder
 * Plain HTML/CSS/JS tool for building interactive conversation funnels.
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'conversationFunnelBuilder_funnel';

  var QUESTION_TYPES = [
    { value: 'single', label: 'Single choice' },
    { value: 'multiple', label: 'Multiple choice' },
    { value: 'text', label: 'Text input' },
    { value: 'email', label: 'Email input' },
    { value: 'statement', label: 'Statement / Continue' }
  ];

  var DEFAULT_STYLES = {
    primaryColor: '#6366f1',
    backgroundColor: '#ffffff',
    textColor: '#334155',
    buttonColor: '#ffffff',
    buttonTextColor: '#334155',
    userBubbleColor: '#dbeafe',
    userBubbleTextColor: '#1e40af',
    borderRadius: '16',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    containerWidth: '420',
    ctaButtonColor: '#6366f1',
    typewriterSpeed: '28'
  };

  /** Preloaded anxiety offer sample funnel */
  var STARTER_FUNNEL = {
    name: 'Anxiety Offer Funnel',
    startStepId: 'step1',
    showProgress: true,
    redirectUrl: '',
    styles: Object.assign({}, DEFAULT_STYLES),
    steps: [
      {
        id: 'step1',
        message: "Let's find out what's keeping your anxiety switched on.",
        subtext: '',
        imageUrl: '',
        questionType: 'statement',
        options: [{ text: 'Start', nextStepId: 'step2', tag: '' }],
        delay: 0,
        ctaText: '',
        ctaUrl: ''
      },
      {
        id: 'step2',
        userMessage: '',
        message: "Good — that tells me you're ready to look at this honestly. Anxiety rarely shows up randomly. It usually follows a pattern.",
        subtext: 'When does anxiety usually show up for you?',
        imageUrl: '',
        questionType: 'single',
        options: [
          { text: 'Before sleep', nextStepId: 'step3', tag: 'before-sleep' },
          { text: 'In the morning', nextStepId: 'step3', tag: 'morning' },
          { text: 'Driving', nextStepId: 'step3', tag: 'driving' },
          { text: 'Work or meetings', nextStepId: 'step3', tag: 'work' },
          { text: 'Randomly', nextStepId: 'step3', tag: 'random' }
        ],
        delay: 0,
        ctaText: '',
        ctaUrl: ''
      },
      {
        id: 'step3',
        userMessage: '',
        message: "That's an important clue. Your body often signals stress before your mind fully catches up.",
        subtext: 'What do you notice first when it hits?',
        imageUrl: '',
        questionType: 'single',
        options: [
          { text: 'Racing thoughts', nextStepId: 'step4', tag: 'thoughts' },
          { text: 'Tight chest', nextStepId: 'step4', tag: 'chest' },
          { text: 'Fast heartbeat', nextStepId: 'step4', tag: 'heartbeat' },
          { text: 'Feeling on edge', nextStepId: 'step4', tag: 'edge' },
          { text: 'Shallow breathing', nextStepId: 'step4', tag: 'breathing' }
        ],
        delay: 0,
        ctaText: '',
        ctaUrl: ''
      },
      {
        id: 'step4',
        userMessage: '',
        message: 'Most people try to fight anxiety at the thought level. But for many people, anxiety starts before the thoughts — inside the body.',
        subtext: '',
        imageUrl: '',
        questionType: 'statement',
        options: [{ text: 'Show me', nextStepId: 'step5', tag: '' }],
        delay: 0,
        ctaText: '',
        ctaUrl: ''
      },
      {
        id: 'step5',
        message: 'Anxiety often appears when three protective systems become highly activated: your brain scanning for danger, your body carrying stress, and your nervous system staying on high alert.',
        subtext: '',
        imageUrl: '',
        questionType: 'statement',
        options: [{ text: 'Continue', nextStepId: 'step6', tag: '' }],
        delay: 0,
        ctaText: '',
        ctaUrl: ''
      },
      {
        id: 'step6',
        userMessage: '',
        message: "You're not broken — your system is doing its job a little too well. The real question is which part feels loudest for you right now.",
        subtext: 'Which one feels most true for you?',
        imageUrl: '',
        questionType: 'single',
        options: [
          { text: "My thoughts won't stop", nextStepId: 'step7', tag: 'thoughts' },
          { text: 'My body feels tense', nextStepId: 'step7', tag: 'body' },
          { text: 'I never fully relax', nextStepId: 'step7', tag: 'relax' },
          { text: 'All of them', nextStepId: 'step7', tag: 'all' }
        ],
        delay: 0,
        ctaText: '',
        ctaUrl: ''
      },
      {
        id: 'step7',
        message: 'Based on your answers, your body may be staying in protection mode longer than it needs to. The 90-Second Reset is designed to help turn those systems down physically.',
        subtext: '',
        imageUrl: '',
        questionType: 'statement',
        options: [],
        delay: 0,
        ctaText: 'Watch the 7-minute explanation',
        ctaUrl: 'https://example.com'
      }
    ]
  };

  /** Current funnel being edited */
  var funnel = deepClone(STARTER_FUNNEL);

  /** Preview runtime state */
  var previewRuntime = createRuntimeState();

  /** Currently selected step in the editor */
  var selectedStepIndex = 0;

  // ─── DOM refs ───────────────────────────────────────────────
  var els = {
    stepList: document.getElementById('step-list'),
    stepEditor: document.getElementById('step-editor'),
    stepEditorEmpty: document.getElementById('step-editor-empty'),
    stylingEditor: document.getElementById('styling-editor'),
    settingsEditor: document.getElementById('settings-editor'),
    funnelName: document.getElementById('funnel-name'),
    previewRoot: document.getElementById('preview-root'),
    validationBanner: document.getElementById('validation-banner'),
    htmlModal: document.getElementById('html-modal'),
    htmlOutput: document.getElementById('html-output'),
    jsonFileInput: document.getElementById('json-file-input')
  };

  // ─── Utilities ──────────────────────────────────────────────

  function normalizeFunnel(data) {
    data.styles = Object.assign({}, DEFAULT_STYLES, data.styles || {});
    (data.steps || []).forEach(function (step) {
      if (step.userMessage === undefined) step.userMessage = '';
    });
    return data;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(message) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('show'); });
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { toast.remove(); }, 300);
    }, 2200);
  }

  function getStepById(stepId) {
    return funnel.steps.find(function (s) { return s.id === stepId; });
  }

  function getStepIds() {
    return funnel.steps.map(function (s) { return s.id; });
  }

  function stepIdExists(stepId) {
    if (!stepId) return true;
    return funnel.steps.some(function (s) { return s.id === stepId; });
  }

  /** Collect validation warnings for the entire funnel */
  function validateFunnel() {
    var warnings = [];
    var seenIds = {};

    funnel.steps.forEach(function (step) {
      if (!step.id || !step.id.trim()) {
        warnings.push({ stepId: step.id, message: 'A step is missing an ID.' });
      } else if (seenIds[step.id]) {
        warnings.push({ stepId: step.id, message: 'Duplicate step ID: "' + step.id + '".' });
      }
      seenIds[step.id] = true;

      if (!step.message || !step.message.trim()) {
        warnings.push({ stepId: step.id, message: step.id + ': message is empty.' });
      }

      (step.options || []).forEach(function (opt) {
        if (opt.nextStepId && !stepIdExists(opt.nextStepId)) {
          warnings.push({
            stepId: step.id,
            message: step.id + ': "' + (opt.text || 'option') + '" links to missing step "' + opt.nextStepId + '".'
          });
        }
      });
    });

    if (funnel.startStepId && !stepIdExists(funnel.startStepId)) {
      warnings.push({ stepId: funnel.startStepId, message: 'Start step "' + funnel.startStepId + '" does not exist.' });
    }

    return warnings;
  }

  function getWarningsForStep(stepId) {
    return validateFunnel().filter(function (w) { return w.stepId === stepId; });
  }

  function renderValidation() {
    var warnings = validateFunnel();
    if (!warnings.length) {
      els.validationBanner.classList.add('hidden');
      els.validationBanner.innerHTML = '';
      return;
    }

    var unique = warnings.slice(0, 5);
    var html = '<strong>' + warnings.length + ' validation issue' + (warnings.length === 1 ? '' : 's') + '</strong>';
    if (unique.length) {
      html += '<ul>' + unique.map(function (w) {
        return '<li>' + escapeHtml(w.message) + '</li>';
      }).join('') + '</ul>';
    }
    if (warnings.length > 5) {
      html += '<span>Select a step to see details.</span>';
    }

    els.validationBanner.innerHTML = html;
    els.validationBanner.classList.remove('hidden');
  }

  function generateStepId() {
    var n = funnel.steps.length + 1;
    var id = 'step' + n;
    while (getStepById(id)) {
      n++;
      id = 'step' + n;
    }
    return id;
  }

  function createRuntimeState() {
    return {
      currentStepId: funnel.startStepId || (funnel.steps[0] && funnel.steps[0].id),
      email: '',
      tags: [],
      answers: {},
      selectedMultiple: [],
      visitedCount: 0,
      completed: false,
      lastAnswerText: '',
      _seq: 0
    };
  }

  function applyWidgetStyles(el, styles) {
    var s = styles || {};
    el.style.setProperty('--cfb-primary', s.primaryColor || '#6366f1');
    el.style.setProperty('--cfb-bg', s.backgroundColor || '#ffffff');
    el.style.setProperty('--cfb-text', s.textColor || '#334155');
    el.style.setProperty('--cfb-btn', s.buttonColor || '#ffffff');
    el.style.setProperty('--cfb-btn-text', s.buttonTextColor || '#334155');
    el.style.setProperty('--cfb-btn-border', 'rgba(148, 163, 184, 0.45)');
    el.style.setProperty('--cfb-cta', s.ctaButtonColor || '#6366f1');
    el.style.setProperty('--cfb-cta-text', '#ffffff');
    el.style.setProperty('--cfb-user-bg', s.userBubbleColor || '#dbeafe');
    el.style.setProperty('--cfb-user-text', s.userBubbleTextColor || '#1e40af');
    el.style.setProperty('--cfb-radius', (s.borderRadius || 16) + 'px');
    el.style.setProperty('--cfb-font', s.fontFamily || 'system-ui, sans-serif');
    el.style.maxWidth = (s.containerWidth || 420) + 'px';
  }

  /** Self-contained chat widget engine (preview + embed). */
  function runFunnelWidget(container, funnelData, runtime, onUpdate) {
    runtime._seq = (runtime._seq || 0) + 1;
    var seq = runtime._seq;
    var styles = funnelData.styles || {};

    function applyWidgetStyles(el, s) {
      s = s || {};
      el.style.setProperty('--cfb-primary', s.primaryColor || '#6366f1');
      el.style.setProperty('--cfb-bg', s.backgroundColor || '#ffffff');
      el.style.setProperty('--cfb-text', s.textColor || '#334155');
      el.style.setProperty('--cfb-btn', s.buttonColor || '#ffffff');
      el.style.setProperty('--cfb-btn-text', s.buttonTextColor || '#334155');
      el.style.setProperty('--cfb-btn-border', 'rgba(148, 163, 184, 0.45)');
      el.style.setProperty('--cfb-cta', s.ctaButtonColor || '#6366f1');
      el.style.setProperty('--cfb-cta-text', '#ffffff');
      el.style.setProperty('--cfb-user-bg', s.userBubbleColor || '#dbeafe');
      el.style.setProperty('--cfb-user-text', s.userBubbleTextColor || '#1e40af');
      el.style.setProperty('--cfb-radius', (s.borderRadius || 16) + 'px');
      el.style.setProperty('--cfb-font', s.fontFamily || 'system-ui, sans-serif');
      el.style.maxWidth = (s.containerWidth || 420) + 'px';
    }

    function alive() { return seq === runtime._seq; }
    function getStep(id) { return funnelData.steps.find(function (s) { return s.id === id; }); }
    function speed() { return parseInt(styles.typewriterSpeed, 10) || 28; }

    function typewriter(el, text, done) {
      if (!alive()) return;
      el.textContent = '';
      var i = 0;
      var ms = speed();
      function tick() {
        if (!alive()) return;
        if (i >= text.length) {
          if (done) done();
          return;
        }
        el.textContent += text.charAt(i);
        i++;
        setTimeout(tick, ms);
      }
      tick();
    }

    function runSequence(steps, index) {
      if (!alive()) return;
      if (index >= steps.length) return;
      steps[index](function () { runSequence(steps, index + 1); });
    }

    function getUserText(step) {
      if (step.userMessage && step.userMessage.trim()) return step.userMessage.trim();
      return runtime.lastAnswerText || '';
    }

    function completeFunnel() {
      runtime.completed = true;
      if (onUpdate) onUpdate(runtime);
      if (funnelData.redirectUrl) {
        setTimeout(function () {
          if (alive()) window.location.href = funnelData.redirectUrl;
        }, 600);
      }
    }

    function goToNext(nextStepId, answerText) {
      runtime.selectedMultiple = [];
      runtime.visitedCount++;
      if (answerText) runtime.lastAnswerText = answerText;
      if (!nextStepId || !getStep(nextStepId)) {
        completeFunnel();
        return;
      }
      runtime.currentStepId = nextStepId;
      if (onUpdate) onUpdate(runtime);
      paintStep();
    }

    function paintStep() {
      container.innerHTML = '';
      var step = getStep(runtime.currentStepId);
      if (!step) {
        container.innerHTML = '<p class="cfb-empty">No steps configured.</p>';
        return;
      }

      var widget = document.createElement('div');
      widget.className = 'cfb-widget';
      applyWidgetStyles(widget, styles);
      container.appendChild(widget);

      if (funnelData.showProgress) {
        var idx = funnelData.steps.findIndex(function (s) { return s.id === runtime.currentStepId; });
        var pct = Math.max(5, Math.round(((idx + 1) / funnelData.steps.length) * 100));
        var progress = document.createElement('div');
        progress.className = 'cfb-progress';
        progress.innerHTML =
          '<div class="cfb-progress-bar"><div class="cfb-progress-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="cfb-progress-text">Step ' + (idx + 1) + ' of ' + funnelData.steps.length + '</div>';
        widget.appendChild(progress);
      }

      var chat = document.createElement('div');
      chat.className = 'cfb-chat-area';
      widget.appendChild(chat);

      var userText = getUserText(step);
      var botWrap = document.createElement('div');
      botWrap.className = 'cfb-bot-block';

      if (step.imageUrl) {
        var img = document.createElement('img');
        img.className = 'cfb-message-image';
        img.src = step.imageUrl;
        img.alt = '';
        botWrap.appendChild(img);
      }

      var responseEl = document.createElement('p');
      responseEl.className = 'cfb-response';
      botWrap.appendChild(responseEl);

      var questionEl = document.createElement('p');
      questionEl.className = 'cfb-question';
      botWrap.appendChild(questionEl);

      chat.appendChild(botWrap);

      var actionsWrap = document.createElement('div');
      actionsWrap.className = 'cfb-actions hidden';
      chat.appendChild(actionsWrap);

      function revealActions() {
        actionsWrap.classList.remove('hidden');
      }

      function buildChoiceButtons(options, onPick) {
        var index = 0;
        function addNextButton() {
          if (index >= options.length) return;
          var opt = options[index];
          var optIndex = index;
          index++;
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'cfb-choice-btn';
          btn.disabled = true;
          var label = document.createElement('span');
          label.className = 'cfb-choice-label';
          btn.appendChild(label);
          btn.addEventListener('click', function () {
            if (btn.disabled) return;
            onPick(opt);
          });
          actionsWrap.appendChild(btn);
          typewriter(label, opt.text, function () {
            if (!alive()) return;
            btn.disabled = false;
            btn.classList.add('cfb-choice-ready');
            addNextButton();
          });
        }
        addNextButton();
      }

      function renderActions() {
        revealActions();
        var type = step.questionType;

        if (type === 'text' || type === 'email') {
          var inputArea = document.createElement('div');
          inputArea.className = 'cfb-input-area';
          var input = document.createElement('input');
          input.className = 'cfb-input';
          input.type = type === 'email' ? 'email' : 'text';
          var placeholder = type === 'email' ? 'Enter your email' : 'Type your answer…';
          var ph = document.createElement('span');
          ph.className = 'cfb-input-placeholder';
          inputArea.appendChild(input);
          inputArea.appendChild(ph);
          var submit = document.createElement('button');
          submit.type = 'button';
          submit.className = 'cfb-btn cfb-btn-submit';
          submit.disabled = true;
          var submitLabel = document.createElement('span');
          submit.appendChild(submitLabel);
          inputArea.appendChild(submit);
          actionsWrap.appendChild(inputArea);

          typewriter(ph, placeholder, function () {
            input.placeholder = placeholder;
            ph.remove();
            typewriter(submitLabel, 'Continue', function () {
              submit.disabled = false;
              submit.addEventListener('click', function () {
                var value = input.value.trim();
                if (!value) { input.focus(); return; }
                if (type === 'email') runtime.email = value;
                runtime.answers[step.id] = value;
                goToNext(step.options[0] && step.options[0].nextStepId, value);
              });
              input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') submit.click();
              });
              input.focus();
            });
          });
          return;
        }

        if (type === 'multiple') {
          runtime.selectedMultiple = runtime.selectedMultiple || [];
          buildChoiceButtons(step.options, function (opt) {
            var idx = step.options.indexOf(opt);
            var pos = runtime.selectedMultiple.indexOf(idx);
            if (pos === -1) runtime.selectedMultiple.push(idx);
            else runtime.selectedMultiple.splice(pos, 1);
            actionsWrap.querySelectorAll('.cfb-choice-btn').forEach(function (b, i) {
              b.classList.toggle('selected', runtime.selectedMultiple.indexOf(i) !== -1);
            });
          });
          var continueBtn = document.createElement('button');
          continueBtn.type = 'button';
          continueBtn.className = 'cfb-btn cfb-btn-submit';
          continueBtn.disabled = true;
          var continueLabel = document.createElement('span');
          continueBtn.appendChild(continueLabel);
          actionsWrap.appendChild(continueBtn);
          typewriter(continueLabel, 'Continue', function () {
            continueBtn.disabled = false;
            continueBtn.addEventListener('click', function () {
              if (!runtime.selectedMultiple.length) return;
              runtime.selectedMultiple.forEach(function (i) {
                if (step.options[i] && step.options[i].tag) runtime.tags.push(step.options[i].tag);
              });
              var texts = runtime.selectedMultiple.map(function (i) { return step.options[i].text; });
              runtime.answers[step.id] = texts;
              var nextId = step.options[runtime.selectedMultiple[0]] &&
                step.options[runtime.selectedMultiple[0]].nextStepId;
              goToNext(nextId, texts.join(', '));
            });
          });
          return;
        }

        if (step.options && step.options.length) {
          buildChoiceButtons(step.options, function (opt) {
            if (opt.tag) runtime.tags.push(opt.tag);
            runtime.answers[step.id] = opt.text;
            goToNext(opt.nextStepId, opt.text);
          });
        }

        if (step.ctaText) {
          var ctaBtn = document.createElement('button');
          ctaBtn.type = 'button';
          ctaBtn.className = 'cfb-btn cfb-btn-cta';
          ctaBtn.disabled = true;
          var ctaLabel = document.createElement('span');
          ctaBtn.appendChild(ctaLabel);
          actionsWrap.appendChild(ctaBtn);
          typewriter(ctaLabel, step.ctaText, function () {
            ctaBtn.disabled = false;
            ctaBtn.addEventListener('click', function () {
              if (step.ctaUrl) window.open(step.ctaUrl, '_blank');
              completeFunnel();
            });
          });
        }
      }

      function startTyping() {
        var sequence = [];

        if (userText) {
          sequence.push(function (next) {
            var userRow = document.createElement('div');
            userRow.className = 'cfb-user-row';
            var bubble = document.createElement('div');
            bubble.className = 'cfb-user-bubble';
            userRow.appendChild(bubble);
            chat.insertBefore(userRow, botWrap);
            typewriter(bubble, userText, next);
          });
        }

        if (step.message && step.message.trim()) {
          sequence.push(function (next) {
            typewriter(responseEl, step.message.trim(), next);
          });
        } else {
          responseEl.style.display = 'none';
        }

        if (step.subtext && step.subtext.trim()) {
          sequence.push(function (next) {
            typewriter(questionEl, step.subtext.trim(), next);
          });
        } else {
          questionEl.style.display = 'none';
        }

        sequence.push(function (next) {
          renderActions();
          next();
        });

        runSequence(sequence, 0);
      }

      if (step.delay > 0) {
        setTimeout(function () { if (alive()) startTyping(); }, step.delay);
      } else {
        startTyping();
      }
    }

    paintStep();
  }

  function renderFunnelWidget(container, funnelData, runtime, onUpdate) {
    runFunnelWidget(container, funnelData, runtime, onUpdate);
  }

  function getStepFromData(funnelData, stepId) {
    return funnelData.steps.find(function (s) { return s.id === stepId; });
  }

  /** CSS string for exported embed */
  function getEmbedCSS() {
    return [
      '.cfb-widget{font-family:var(--cfb-font,system-ui,sans-serif);background:var(--cfb-bg,#fff);color:var(--cfb-text,#334155);padding:1.25rem 1rem;min-height:320px;display:flex;flex-direction:column;max-width:100%;margin:0 auto;box-sizing:border-box}',
      '.cfb-progress{margin-bottom:1rem}.cfb-progress-bar{height:4px;background:rgba(0,0,0,.06);border-radius:999px;overflow:hidden}',
      '.cfb-progress-fill{height:100%;background:var(--cfb-primary,#6366f1);border-radius:999px;transition:width .4s ease}',
      '.cfb-progress-text{font-size:.72rem;color:rgba(51,65,85,.55);margin-top:.35rem}',
      '.cfb-chat-area{flex:1;display:flex;flex-direction:column;gap:1rem;padding-top:.25rem}',
      '.cfb-user-row{display:flex;justify-content:flex-end}',
      '.cfb-user-bubble{background:var(--cfb-user-bg,#dbeafe);color:var(--cfb-user-text,#1e40af);padding:.75rem 1rem;border-radius:18px 18px 4px 18px;max-width:88%;font-size:.9375rem;line-height:1.5;min-height:1.5em}',
      '.cfb-bot-block{display:flex;flex-direction:column;gap:.85rem}',
      '.cfb-response{margin:0;font-size:.9375rem;line-height:1.6;color:var(--cfb-text,#334155);min-height:1.5em}',
      '.cfb-question{margin:0;font-size:.9375rem;line-height:1.55;font-weight:700;color:var(--cfb-text,#334155);min-height:1.5em}',
      '.cfb-message-image{width:100%;border-radius:12px;display:block}',
      '.cfb-actions{display:flex;flex-direction:column;gap:.55rem;margin-top:.25rem}',
      '.cfb-actions.hidden{visibility:hidden;height:0;margin:0;overflow:hidden}',
      '.cfb-choice-btn{display:flex;align-items:center;width:100%;padding:.85rem 1rem;border:1px solid var(--cfb-btn-border,rgba(148,163,184,.45));border-radius:12px;background:var(--cfb-btn,#fff);color:var(--cfb-btn-text,#334155);font-size:.9375rem;font-weight:500;font-family:inherit;cursor:pointer;text-align:left;box-sizing:border-box;transition:border-color .15s,box-shadow .15s}',
      '.cfb-choice-btn:disabled{cursor:default;opacity:.85}',
      '.cfb-choice-btn.cfb-choice-ready:not(:disabled):hover{border-color:var(--cfb-primary,#6366f1);box-shadow:0 0 0 3px rgba(99,102,241,.12)}',
      '.cfb-choice-btn.selected{border-color:var(--cfb-primary,#6366f1);background:rgba(99,102,241,.06)}',
      '.cfb-choice-label{min-height:1.25em}',
      '.cfb-input-area{display:flex;flex-direction:column;gap:.5rem}',
      '.cfb-input{width:100%;padding:.875rem 1rem;border:1px solid var(--cfb-btn-border,rgba(148,163,184,.45));border-radius:12px;font-size:1rem;font-family:inherit;background:#fff;color:var(--cfb-text,#334155);box-sizing:border-box}',
      '.cfb-input:focus{outline:none;border-color:var(--cfb-primary,#6366f1);box-shadow:0 0 0 3px rgba(99,102,241,.12)}',
      '.cfb-input-placeholder{font-size:.8rem;color:rgba(51,65,85,.45);min-height:1em}',
      '.cfb-btn{display:block;width:100%;padding:.9rem 1rem;border:1px solid transparent;border-radius:12px;background:var(--cfb-btn,#fff);color:var(--cfb-btn-text,#334155);font-size:.9375rem;font-weight:600;font-family:inherit;cursor:pointer;box-sizing:border-box}',
      '.cfb-btn:disabled{opacity:.7;cursor:default}',
      '.cfb-btn-submit{border-color:var(--cfb-btn-border,rgba(148,163,184,.45))}',
      '.cfb-btn-cta{background:var(--cfb-cta,#6366f1);color:var(--cfb-cta-text,#fff);border-color:var(--cfb-cta,#6366f1)}',
      '.cfb-empty{padding:1rem;color:#64748b;font-size:.875rem}'
    ].join('');
  }

  // ─── Editor rendering ───────────────────────────────────────

  function renderEditor() {
    els.funnelName.value = funnel.name;
    renderStepList();
    renderStepEditor();
    renderStylingEditor();
    renderSettingsEditor();
    renderValidation();
  }

  /** Left panel: compact step list */
  function renderStepList() {
    if (!funnel.steps.length) {
      els.stepList.innerHTML =
        '<div class="empty-state step-list-empty">' +
        '<div class="empty-icon">🧩</div>' +
        '<h3>No steps yet</h3>' +
        '<p>Add your first conversation step to begin building the funnel.</p>' +
        '</div>';
      return;
    }

    var html = '';
    funnel.steps.forEach(function (step, index) {
      var typeLabel = QUESTION_TYPES.find(function (t) { return t.value === step.questionType; });
      typeLabel = typeLabel ? typeLabel.label : step.questionType;
      var stepWarnings = getWarningsForStep(step.id);
      var active = index === selectedStepIndex ? ' active' : '';
      var warn = stepWarnings.length ? ' has-warning' : '';

      html += '<button type="button" class="step-list-item' + active + warn + '" data-select-step="' + index + '">';
      html += '<span class="step-list-number">' + (index + 1) + '</span>';
      html += '<span class="step-list-content">';
      html += '<span class="step-list-id">' + escapeHtml(step.id) + '</span>';
      html += '<span class="step-list-message">' + escapeHtml(step.subtext || step.message || '(empty step)') + '</span>';
      html += '<span class="step-list-meta">';
      html += '<span class="step-list-type">' + escapeHtml(typeLabel) + '</span>';
      if (stepWarnings.length) {
        html += '<span class="step-list-warning">⚠ ' + stepWarnings.length + '</span>';
      }
      html += '</span></span></button>';
    });

    els.stepList.innerHTML = html;

    els.stepList.querySelectorAll('[data-select-step]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncEditorToFunnel();
        selectedStepIndex = parseInt(btn.getAttribute('data-select-step'), 10);
        renderStepList();
        renderStepEditor();
      });
    });
  }

  /** Middle panel: edit the selected step */
  function renderStepEditor() {
    if (!funnel.steps.length || selectedStepIndex < 0 || selectedStepIndex >= funnel.steps.length) {
      els.stepEditorEmpty.classList.remove('hidden');
      els.stepEditor.innerHTML = '';
      els.stepEditor.classList.add('hidden');
      return;
    }

    els.stepEditorEmpty.classList.add('hidden');
    els.stepEditor.classList.remove('hidden');

    var step = funnel.steps[selectedStepIndex];
    var stepWarnings = getWarningsForStep(step.id);
    var html = '';

    html += '<div class="step-editor-header">';
    html += '<div><h3>Edit step</h3><div class="step-editor-id">' + escapeHtml(step.id) + '</div></div>';
    html += '</div>';

    if (stepWarnings.length) {
      html += '<div class="step-warnings"><ul>' +
        stepWarnings.map(function (w) { return '<li>' + escapeHtml(w.message) + '</li>'; }).join('') +
        '</ul></div>';
    }

    html += buildStepForm(step, selectedStepIndex);
    els.stepEditor.innerHTML = html;
    bindStepEditorEvents();
  }

  function buildStepForm(step, index) {
    var stepIds = getStepIds();
    var html = '';

    html += '<div class="form-grid">';
    html += field('Step ID', 'text', 'step-id', step.id);
    html += field('Delay (ms)', 'number', 'step-delay', step.delay || 0);
    html += '</div>';

    html += field('User message (optional)', 'textarea', 'step-user-message', step.userMessage || '');
    html += '<p class="field-hint">Shown as a user bubble. Leave empty to use the previous answer automatically.</p>';
    html += field('Bot response', 'textarea', 'step-message', step.message);
    html += '<p class="field-hint">Context delivered first — types out before the question and buttons.</p>';
    html += field('Question', 'textarea', 'step-subtext', step.subtext);
    html += '<p class="field-hint">Bold question shown after the response finishes. Buttons appear last.</p>';
    html += field('Image URL (optional)', 'url', 'step-image', step.imageUrl);

    html += '<div class="form-group"><label>Question type</label><select id="step-question-type">';
    QUESTION_TYPES.forEach(function (qt) {
      html += '<option value="' + qt.value + '"' + (step.questionType === qt.value ? ' selected' : '') + '>' + qt.label + '</option>';
    });
    html += '</select></div>';

    if (step.questionType !== 'text' && step.questionType !== 'email') {
      html += '<div class="form-section"><h4 class="form-section-title">Answer options</h4>';
      html += '<div class="options-list" id="options-list">';
      (step.options || []).forEach(function (opt, optIdx) {
        html += buildOptionRow(optIdx, opt, stepIds);
      });
      html += '</div>';
      html += '<div style="margin-top:0.65rem"><button type="button" class="btn btn-secondary btn-sm" id="btn-add-option">+ Add option</button></div></div>';
    } else {
      html += '<div class="form-section"><h4 class="form-section-title">Next step after input</h4>';
      html += '<div class="form-group"><label>Next step ID</label>';
      html += buildNextStepSelect('input-next-step', step.options[0] && step.options[0].nextStepId, stepIds);
      html += '</div></div>';
    }

    html += '<div class="form-section"><h4 class="form-section-title">Call to action</h4>';
    html += '<div class="form-grid">';
    html += field('CTA button text (optional)', 'text', 'step-cta-text', step.ctaText);
    html += field('CTA URL (optional)', 'url', 'step-cta-url', step.ctaUrl);
    html += '</div></div>';

    html += '<div class="step-actions">';
    html += '<button type="button" class="btn btn-danger btn-sm" id="btn-delete-step">Delete step</button>';
    html += '</div>';

    return html;
  }

  function buildNextStepSelect(id, selectedId, stepIds) {
    var html = '<select id="' + id + '"' + (!stepIdExists(selectedId) && selectedId ? ' class="invalid"' : '') + '>';
    html += '<option value="">— End funnel —</option>';
    stepIds.forEach(function (sid) {
      html += '<option value="' + sid + '"' + (selectedId === sid ? ' selected' : '') + '>' + sid + '</option>';
    });
    if (selectedId && stepIds.indexOf(selectedId) === -1) {
      html += '<option value="' + escapeHtml(selectedId) + '" selected>⚠ ' + escapeHtml(selectedId) + ' (missing)</option>';
    }
    html += '</select>';
    if (selectedId && !stepIdExists(selectedId)) {
      html += '<p class="option-warning">This step ID does not exist.</p>';
    }
    return html;
  }

  function buildOptionRow(optIndex, opt, stepIds) {
    var invalid = opt.nextStepId && !stepIdExists(opt.nextStepId);
    var html = '<div class="option-row' + (invalid ? ' has-invalid-next' : '') + '" data-opt="' + optIndex + '">';
    html += '<div><label>Button text</label><input type="text" data-opt-field="text" value="' + escapeHtml(opt.text) + '"></div>';
    html += '<div><label>Next step</label><select data-opt-field="nextStepId"' + (invalid ? ' class="invalid"' : '') + '>';
    html += '<option value="">— End —</option>';
    stepIds.forEach(function (sid) {
      html += '<option value="' + sid + '"' + (opt.nextStepId === sid ? ' selected' : '') + '>' + sid + '</option>';
    });
    if (opt.nextStepId && stepIds.indexOf(opt.nextStepId) === -1) {
      html += '<option value="' + escapeHtml(opt.nextStepId) + '" selected>⚠ ' + escapeHtml(opt.nextStepId) + '</option>';
    }
    html += '</select></div>';
    html += '<div><label>Tag/value</label><input type="text" data-opt-field="tag" value="' + escapeHtml(opt.tag || '') + '"></div>';
    html += '<div><label>&nbsp;</label><button type="button" class="btn btn-danger btn-sm" data-remove-option="' + optIndex + '">×</button></div>';
    if (invalid) {
      html += '<p class="option-warning">Next step "' + escapeHtml(opt.nextStepId) + '" does not exist.</p>';
    }
    html += '</div>';
    return html;
  }

  function field(label, type, id, value) {
    if (type === 'textarea') {
      return '<div class="form-group"><label for="' + id + '">' + label + '</label><textarea id="' + id + '" rows="3">' + escapeHtml(value) + '</textarea></div>';
    }
    return '<div class="form-group"><label for="' + id + '">' + label + '</label><input type="' + type + '" id="' + id + '" value="' + escapeHtml(value) + '"></div>';
  }

  function bindStepEditorEvents() {
    var editor = els.stepEditor;
    if (!editor) return;

    function onChange() {
      syncEditorToFunnel();
      renderStepList();
      renderSettingsEditor();
      renderValidation();
      renderPreview();
    }

    editor.querySelectorAll('input, textarea, select').forEach(function (input) {
      input.addEventListener('change', onChange);
      input.addEventListener('blur', onChange);
    });

    var typeSelect = document.getElementById('step-question-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', function () {
        syncEditorToFunnel();
        var step = funnel.steps[selectedStepIndex];
        if (step.questionType === 'text' || step.questionType === 'email') {
          step.options = [{
            text: '',
            nextStepId: funnel.steps[selectedStepIndex + 1] ? funnel.steps[selectedStepIndex + 1].id : '',
            tag: ''
          }];
        } else if (step.questionType === 'statement' && (!step.options || !step.options.length)) {
          step.options = [{
            text: 'Continue',
            nextStepId: funnel.steps[selectedStepIndex + 1] ? funnel.steps[selectedStepIndex + 1].id : step.id,
            tag: ''
          }];
        }
        renderStepEditor();
        renderStepList();
        renderValidation();
        renderPreview();
      });
    }

    var addOptBtn = document.getElementById('btn-add-option');
    if (addOptBtn) {
      addOptBtn.addEventListener('click', function () {
        syncEditorToFunnel();
        var step = funnel.steps[selectedStepIndex];
        var nextId = funnel.steps[selectedStepIndex + 1] ? funnel.steps[selectedStepIndex + 1].id : '';
        step.options.push({ text: 'New option', nextStepId: nextId, tag: '' });
        renderStepEditor();
        renderValidation();
      });
    }

    editor.querySelectorAll('[data-remove-option]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncEditorToFunnel();
        var oIdx = parseInt(btn.getAttribute('data-remove-option'), 10);
        funnel.steps[selectedStepIndex].options.splice(oIdx, 1);
        renderStepEditor();
        renderValidation();
      });
    });

    var deleteBtn = document.getElementById('btn-delete-step');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        if (funnel.steps.length <= 1) {
          showToast('You need at least one step.');
          return;
        }
        syncEditorToFunnel();
        var removed = funnel.steps.splice(selectedStepIndex, 1)[0];
        if (funnel.startStepId === removed.id) {
          funnel.startStepId = funnel.steps[0].id;
        }
        selectedStepIndex = Math.min(selectedStepIndex, funnel.steps.length - 1);
        renderEditor();
        renderPreview();
      });
    }
  }

  function syncEditorToFunnel() {
    funnel.name = els.funnelName.value;

    if (selectedStepIndex < 0 || selectedStepIndex >= funnel.steps.length) return;
    var step = funnel.steps[selectedStepIndex];

    var idEl = document.getElementById('step-id');
    if (idEl) {
      var newId = idEl.value.trim();
      if (newId && newId !== step.id) step.id = newId;
    }

    var userEl = document.getElementById('step-user-message');
    if (userEl) step.userMessage = userEl.value;

    var msgEl = document.getElementById('step-message');
    if (msgEl) step.message = msgEl.value;

    var subEl = document.getElementById('step-subtext');
    if (subEl) step.subtext = subEl.value;

    var imgEl = document.getElementById('step-image');
    if (imgEl) step.imageUrl = imgEl.value.trim();

    var delayEl = document.getElementById('step-delay');
    if (delayEl) step.delay = parseInt(delayEl.value, 10) || 0;

    var ctaTextEl = document.getElementById('step-cta-text');
    if (ctaTextEl) step.ctaText = ctaTextEl.value;

    var ctaUrlEl = document.getElementById('step-cta-url');
    if (ctaUrlEl) step.ctaUrl = ctaUrlEl.value.trim();

    var typeSelect = document.getElementById('step-question-type');
    if (typeSelect) step.questionType = typeSelect.value;

    if (step.questionType === 'text' || step.questionType === 'email') {
      var nextSelect = document.getElementById('input-next-step');
      var nextId = nextSelect ? nextSelect.value : '';
      step.options = [{ text: '', nextStepId: nextId, tag: '' }];
    } else {
      var optionRows = els.stepEditor.querySelectorAll('.option-row');
      step.options = [];
      optionRows.forEach(function (row) {
        step.options.push({
          text: row.querySelector('[data-opt-field="text"]').value,
          nextStepId: row.querySelector('[data-opt-field="nextStepId"]').value,
          tag: row.querySelector('[data-opt-field="tag"]').value
        });
      });
    }
  }

  function renderStylingEditor() {
    var s = funnel.styles;
    var fields = [
      { key: 'primaryColor', label: 'Primary color', type: 'color' },
      { key: 'backgroundColor', label: 'Background color', type: 'color' },
      { key: 'textColor', label: 'Text color', type: 'color' },
      { key: 'userBubbleColor', label: 'User bubble color', type: 'color' },
      { key: 'userBubbleTextColor', label: 'User bubble text', type: 'color' },
      { key: 'buttonColor', label: 'Choice button bg', type: 'color' },
      { key: 'buttonTextColor', label: 'Choice button text', type: 'color' },
      { key: 'ctaButtonColor', label: 'CTA button color', type: 'color' },
      { key: 'typewriterSpeed', label: 'Typewriter speed (ms/char)', type: 'number' },
      { key: 'borderRadius', label: 'Border radius (px)', type: 'number' },
      { key: 'containerWidth', label: 'Container width (px)', type: 'number' },
      { key: 'fontFamily', label: 'Font family', type: 'text' }
    ];

    var html = '';
    fields.forEach(function (f) {
      html += '<div class="form-group"><label>' + f.label + '</label>';
      html += '<input type="' + f.type + '" data-style-key="' + f.key + '" value="' + escapeHtml(String(s[f.key] || '')) + '">';
      html += '</div>';
    });

    els.stylingEditor.innerHTML = html;

    els.stylingEditor.querySelectorAll('input').forEach(function (input) {
      input.addEventListener('input', function () {
        funnel.styles[input.getAttribute('data-style-key')] = input.value;
        renderPreview();
      });
    });
  }

  function renderSettingsEditor() {
    els.settingsEditor.innerHTML =
      '<div class="form-group"><label for="start-step-id">Start step ID</label>' +
      '<select id="start-step-id">' +
      getStepIds().map(function (id) {
        return '<option value="' + id + '"' + (funnel.startStepId === id ? ' selected' : '') + '>' + id + '</option>';
      }).join('') +
      '</select></div>' +
      '<div class="form-group"><label for="redirect-url">Redirect URL after completion</label>' +
      '<input type="url" id="redirect-url" placeholder="https://..." value="' + escapeHtml(funnel.redirectUrl) + '"></div>' +
      '<div class="form-group checkbox-row"><input type="checkbox" id="show-progress"' + (funnel.showProgress ? ' checked' : '') + '>' +
      '<label for="show-progress" style="margin:0">Show progress indicator</label></div>';

    document.getElementById('start-step-id').addEventListener('change', function (e) {
      funnel.startStepId = e.target.value;
      renderValidation();
      renderPreview();
    });
    document.getElementById('redirect-url').addEventListener('change', function (e) {
      funnel.redirectUrl = e.target.value.trim();
    });
    document.getElementById('show-progress').addEventListener('change', function (e) {
      funnel.showProgress = e.target.checked;
      renderPreview();
    });
  }

  // ─── Preview ────────────────────────────────────────────────

  function renderPreview() {
    syncEditorToFunnel();
    renderValidation();
    renderFunnelWidget(els.previewRoot, funnel, previewRuntime, function () {});
  }

  function restartPreview() {
    previewRuntime = createRuntimeState();
    renderPreview();
  }

  // ─── Step management ────────────────────────────────────────

  function addStep() {
    syncEditorToFunnel();
    var newId = generateStepId();
    funnel.steps.push({
      id: newId,
      userMessage: '',
      message: 'Thanks — here is a helpful response before the next question.',
      subtext: 'What would you like to do next?',
      imageUrl: '',
      questionType: 'single',
      options: [
        { text: 'Option A', nextStepId: funnel.startStepId, tag: '' },
        { text: 'Option B', nextStepId: funnel.startStepId, tag: '' }
      ],
      delay: 0,
      ctaText: '',
      ctaUrl: ''
    });
    selectedStepIndex = funnel.steps.length - 1;
    renderEditor();
    renderPreview();
  }

  function deleteStep(index) {
    if (funnel.steps.length <= 1) return;
    funnel.steps.splice(index, 1);
    renderEditor();
    renderPreview();
  }

  // ─── Save / Load / Import / Export ──────────────────────────

  function saveToLocalStorage() {
    syncEditorToFunnel();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(funnel));
    showToast('Funnel saved to localStorage.');
  }

  function loadFromLocalStorage() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      showToast('No saved funnel found.');
      return;
    }
    try {
      funnel = normalizeFunnel(JSON.parse(raw));
      selectedStepIndex = 0;
      renderEditor();
      restartPreview();
      showToast('Funnel loaded from localStorage.');
    } catch (e) {
      showToast('Failed to load saved funnel.');
    }
  }

  function exportJSON() {
    syncEditorToFunnel();
    var blob = new Blob([JSON.stringify(funnel, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (funnel.name || 'funnel').replace(/\s+/g, '-').toLowerCase() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('JSON exported.');
  }

  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        funnel = normalizeFunnel(JSON.parse(e.target.result));
        if (!funnel.steps || !funnel.steps.length) throw new Error('Invalid funnel');
        selectedStepIndex = 0;
        renderEditor();
        restartPreview();
        showToast('Funnel imported.');
      } catch (err) {
        showToast('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  }

  // ─── HTML embed generation ────────────────────────────────────

  /**
   * Generates a self-contained HTML snippet for Systeme.io raw HTML blocks.
   */
  function generateEmbedHTML() {
    syncEditorToFunnel();
    var dataJson = JSON.stringify(funnel);
    var widgetId = 'cfb-' + Math.random().toString(36).slice(2, 9);
    var css = getEmbedCSS();
    var engineSource = runFunnelWidget.toString();
    var js =
      '(function(){' +
      'var DATA=' + dataJson + ';' +
      'var state={currentStepId:DATA.startStepId||(DATA.steps[0]&&DATA.steps[0].id),email:"",tags:[],answers:{},selectedMultiple:[],visitedCount:0,completed:false,lastAnswerText:"",_seq:0};' +
      'var root=document.getElementById("' + widgetId + '");' +
      'var runFunnelWidget=' + engineSource + ';' +
      'runFunnelWidget(root,DATA,state,null);' +
      'window.conversationFunnelState=state;' +
      '})();';

    return (
      '<div id="' + widgetId + '"></div>\n' +
      '<style>' + css + '</style>\n' +
      '<script>' + js + '<\/script>'
    );
  }

  function showHtmlModal() {
    els.htmlOutput.value = generateEmbedHTML();
    els.htmlModal.classList.remove('hidden');
  }

  function copyHtmlToClipboard() {
    var text = els.htmlOutput.value;
    navigator.clipboard.writeText(text).then(function () {
      showToast('HTML copied to clipboard.');
    }).catch(function () {
      els.htmlOutput.select();
      document.execCommand('copy');
      showToast('HTML copied to clipboard.');
    });
  }

  // ─── Tab switching ──────────────────────────────────────────

  function initTabs() {
    document.querySelectorAll('.panel-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');
        document.querySelectorAll('.panel-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        document.getElementById('tab-' + target).classList.add('active');
      });
    });
  }

  // ─── Event bindings ─────────────────────────────────────────

  function initEvents() {
    document.getElementById('btn-add-step').addEventListener('click', addStep);
    document.getElementById('btn-save').addEventListener('click', saveToLocalStorage);
    document.getElementById('btn-load').addEventListener('click', loadFromLocalStorage);
    document.getElementById('btn-export-json').addEventListener('click', exportJSON);
    document.getElementById('btn-import-json').addEventListener('click', function () {
      els.jsonFileInput.click();
    });
    els.jsonFileInput.addEventListener('change', function (e) {
      if (e.target.files[0]) importJSON(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('btn-generate-html').addEventListener('click', showHtmlModal);
    document.getElementById('html-modal-close').addEventListener('click', function () {
      els.htmlModal.classList.add('hidden');
    });
    document.getElementById('btn-copy-html').addEventListener('click', copyHtmlToClipboard);
    document.getElementById('btn-copy-html-secondary').addEventListener('click', copyHtmlToClipboard);
    document.getElementById('btn-restart-preview').addEventListener('click', restartPreview);
    els.funnelName.addEventListener('change', function () {
      funnel.name = els.funnelName.value;
    });

    els.htmlModal.addEventListener('click', function (e) {
      if (e.target === els.htmlModal) els.htmlModal.classList.add('hidden');
    });
  }

  // ─── Init ───────────────────────────────────────────────────

  function init() {
    funnel = normalizeFunnel(funnel);
    initTabs();
    initEvents();
    renderEditor();
    renderPreview();
  }

  init();
})();
