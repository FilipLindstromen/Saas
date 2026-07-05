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
    backgroundColor: '#f8fafc',
    textColor: '#1e293b',
    buttonColor: '#6366f1',
    buttonTextColor: '#ffffff',
    borderRadius: '16',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    containerWidth: '420',
    ctaButtonColor: '#10b981'
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
        message: 'When does anxiety usually show up?',
        subtext: '',
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
        message: 'What do you notice first?',
        subtext: '',
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
        message: 'Which one feels most true for you?',
        subtext: '',
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
      completed: false
    };
  }

  function applyStyleVars(el, styles) {
    var s = styles || funnel.styles;
    el.style.setProperty('--cfb-primary', s.primaryColor);
    el.style.setProperty('--cfb-bg', s.backgroundColor);
    el.style.setProperty('--cfb-text', s.textColor);
    el.style.setProperty('--cfb-text-muted', hexToRgba(s.textColor, 0.65));
    el.style.setProperty('--cfb-btn', s.buttonColor);
    el.style.setProperty('--cfb-btn-text', s.buttonTextColor);
    el.style.setProperty('--cfb-cta', s.ctaButtonColor);
    el.style.setProperty('--cfb-radius', s.borderRadius + 'px');
    el.style.setProperty('--cfb-font', s.fontFamily);
    el.style.maxWidth = s.containerWidth + 'px';
  }

  function hexToRgba(hex, alpha) {
    var h = (hex || '#1e293b').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(h.substring(0, 2), 16) || 30;
    var g = parseInt(h.substring(2, 4), 16) || 41;
    var b = parseInt(h.substring(4, 6), 16) || 59;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // ─── Funnel widget renderer (preview + embed) ───────────────

  /**
   * Renders the conversational funnel into a container element.
   * Used by both the live preview and the exported embed.
   */
  function renderFunnelWidget(container, funnelData, runtime, onUpdate) {
    container.innerHTML = '';
    var widget = document.createElement('div');
    widget.className = 'cfb-widget';
    applyStyleVars(widget, funnelData.styles);
    container.appendChild(widget);

    var step = getStepFromData(funnelData, runtime.currentStepId);
    if (!step) {
      widget.innerHTML = '<p class="cfb-message-text">No steps configured.</p>';
      return;
    }

    // Progress indicator
    if (funnelData.showProgress) {
      var total = funnelData.steps.length;
      var currentIndex = funnelData.steps.findIndex(function (s) { return s.id === runtime.currentStepId; });
      var pct = Math.max(5, Math.round(((currentIndex + 1) / total) * 100));
      var progress = document.createElement('div');
      progress.className = 'cfb-progress';
      progress.innerHTML =
        '<div class="cfb-progress-bar"><div class="cfb-progress-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="cfb-progress-text">Step ' + (currentIndex + 1) + ' of ' + total + '</div>';
      widget.appendChild(progress);
    }

    var chatArea = document.createElement('div');
    chatArea.className = 'cfb-chat-area';
    widget.appendChild(chatArea);

    function showStep() {
      chatArea.innerHTML = '';
      var current = getStepFromData(funnelData, runtime.currentStepId);
      if (!current) return;

      var renderContent = function () {
        var msg = document.createElement('div');
        msg.className = 'cfb-message';

        if (current.imageUrl) {
          var img = document.createElement('img');
          img.className = 'cfb-message-image';
          img.src = current.imageUrl;
          img.alt = '';
          msg.appendChild(img);
        }

        var text = document.createElement('p');
        text.className = 'cfb-message-text';
        text.textContent = current.message;
        msg.appendChild(text);

        if (current.subtext) {
          var sub = document.createElement('p');
          sub.className = 'cfb-message-subtext';
          sub.textContent = current.subtext;
          msg.appendChild(sub);
        }

        chatArea.appendChild(msg);
        renderInputArea(current);
      };

      if (current.delay > 0) {
        setTimeout(renderContent, current.delay);
      } else {
        renderContent();
      }
    }

    function renderInputArea(current) {
      var type = current.questionType;

      if (type === 'text' || type === 'email') {
        var inputArea = document.createElement('div');
        inputArea.className = 'cfb-input-area';

        var input = document.createElement('input');
        input.className = 'cfb-input';
        input.type = type === 'email' ? 'email' : 'text';
        input.placeholder = type === 'email' ? 'Enter your email' : 'Type your answer…';

        var submit = document.createElement('button');
        submit.type = 'button';
        submit.className = 'cfb-btn cfb-btn-submit';
        submit.textContent = 'Continue';

        submit.addEventListener('click', function () {
          var value = input.value.trim();
          if (!value) {
            input.focus();
            return;
          }
          if (type === 'email') {
            runtime.email = value;
          }
          runtime.answers[current.id] = value;
          goToNext(current.options[0] && current.options[0].nextStepId);
        });

        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') submit.click();
        });

        inputArea.appendChild(input);
        inputArea.appendChild(submit);
        chatArea.appendChild(inputArea);
        input.focus();
        return;
      }

      if (type === 'multiple') {
        runtime.selectedMultiple = runtime.selectedMultiple || [];
        var multiWrap = document.createElement('div');
        multiWrap.className = 'cfb-buttons';

        current.options.forEach(function (opt, idx) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'cfb-btn';
          btn.textContent = opt.text;
          if (runtime.selectedMultiple.indexOf(idx) !== -1) {
            btn.classList.add('selected');
          }
          btn.addEventListener('click', function () {
            var pos = runtime.selectedMultiple.indexOf(idx);
            if (pos === -1) runtime.selectedMultiple.push(idx);
            else runtime.selectedMultiple.splice(pos, 1);
            btn.classList.toggle('selected');
          });
          multiWrap.appendChild(btn);
        });

        var continueBtn = document.createElement('button');
        continueBtn.type = 'button';
        continueBtn.className = 'cfb-btn cfb-btn-submit';
        continueBtn.textContent = 'Continue';
        continueBtn.addEventListener('click', function () {
          if (!runtime.selectedMultiple.length) return;
          runtime.selectedMultiple.forEach(function (idx) {
            var opt = current.options[idx];
            if (opt && opt.tag) runtime.tags.push(opt.tag);
          });
          runtime.answers[current.id] = runtime.selectedMultiple.map(function (i) {
            return current.options[i].text;
          });
          var nextId = current.options[runtime.selectedMultiple[0]] &&
            current.options[runtime.selectedMultiple[0]].nextStepId;
          goToNext(nextId);
        });

        multiWrap.appendChild(continueBtn);
        chatArea.appendChild(multiWrap);
        return;
      }

      // single choice or statement
      if (current.options && current.options.length) {
        var btnWrap = document.createElement('div');
        btnWrap.className = 'cfb-buttons';

        current.options.forEach(function (opt) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'cfb-btn';
          btn.textContent = opt.text;
          btn.addEventListener('click', function () {
            if (opt.tag) runtime.tags.push(opt.tag);
            runtime.answers[current.id] = opt.text;
            goToNext(opt.nextStepId);
          });
          btnWrap.appendChild(btn);
        });

        chatArea.appendChild(btnWrap);
      }

      // CTA button (result / final step)
      if (current.ctaText) {
        var ctaWrap = document.createElement('div');
        ctaWrap.className = 'cfb-buttons';
        var ctaBtn = document.createElement('button');
        ctaBtn.type = 'button';
        ctaBtn.className = 'cfb-btn cfb-btn-cta';
        ctaBtn.textContent = current.ctaText;
        ctaBtn.addEventListener('click', function () {
          if (current.ctaUrl) {
            window.open(current.ctaUrl, '_blank');
          }
          completeFunnel();
        });
        ctaWrap.appendChild(ctaBtn);
        chatArea.appendChild(ctaWrap);
      }
    }

    function goToNext(nextStepId) {
      runtime.selectedMultiple = [];
      runtime.visitedCount++;

      if (!nextStepId || !getStepFromData(funnelData, nextStepId)) {
        completeFunnel();
        return;
      }

      runtime.currentStepId = nextStepId;
      if (onUpdate) onUpdate(runtime);
      showStep();
    }

    function completeFunnel() {
      runtime.completed = true;
      if (onUpdate) onUpdate(runtime);
      if (funnelData.redirectUrl) {
        setTimeout(function () {
          window.location.href = funnelData.redirectUrl;
        }, 600);
      }
    }

    showStep();
  }

  function getStepFromData(funnelData, stepId) {
    return funnelData.steps.find(function (s) { return s.id === stepId; });
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
      html += '<span class="step-list-message">' + escapeHtml(step.message || '(empty message)') + '</span>';
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

    html += field('Message', 'textarea', 'step-message', step.message);
    html += field('Subtext (optional)', 'textarea', 'step-subtext', step.subtext);
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
      { key: 'buttonColor', label: 'Button color', type: 'color' },
      { key: 'buttonTextColor', label: 'Button text color', type: 'color' },
      { key: 'ctaButtonColor', label: 'CTA button color', type: 'color' },
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
      message: 'New message',
      subtext: '',
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
      funnel = JSON.parse(raw);
      if (!funnel.styles) funnel.styles = deepClone(DEFAULT_STYLES);
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
        funnel = JSON.parse(e.target.result);
        if (!funnel.steps || !funnel.steps.length) throw new Error('Invalid funnel');
        if (!funnel.styles) funnel.styles = deepClone(DEFAULT_STYLES);
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

    // Inline CSS (matches .cfb-* classes in styles.css)
    var css =
      '.cfb-widget{font-family:var(--cfb-font,system-ui,sans-serif);background:var(--cfb-bg,#f8fafc);color:var(--cfb-text,#1e293b);border-radius:var(--cfb-radius,16px);padding:1.25rem;min-height:320px;display:flex;flex-direction:column;max-width:100%;margin:0 auto}' +
      '.cfb-progress{margin-bottom:1rem}.cfb-progress-bar{height:4px;background:rgba(0,0,0,.08);border-radius:999px;overflow:hidden}' +
      '.cfb-progress-fill{height:100%;background:var(--cfb-primary,#6366f1);border-radius:999px;transition:width .4s ease}' +
      '.cfb-progress-text{font-size:.75rem;color:var(--cfb-text-muted,rgba(30,41,59,.55));margin-top:.35rem}' +
      '.cfb-chat-area{flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:.75rem}' +
      '.cfb-message{background:#fff;border-radius:calc(var(--cfb-radius,16px)*.75);padding:1rem 1.1rem;box-shadow:0 2px 12px rgba(0,0,0,.06);animation:cfbFadeIn .45s ease}' +
      '.cfb-message-text{font-size:1rem;line-height:1.55;margin:0}.cfb-message-subtext{font-size:.875rem;color:var(--cfb-text-muted,rgba(30,41,59,.65));margin:.5rem 0 0;line-height:1.45}' +
      '.cfb-message-image{width:100%;border-radius:calc(var(--cfb-radius,16px)*.5);margin-bottom:.75rem;display:block}' +
      '.cfb-input-area{margin-top:.75rem;display:flex;flex-direction:column;gap:.5rem;animation:cfbFadeIn .35s ease .1s both}' +
      '.cfb-input{width:100%;padding:.875rem 1rem;border:2px solid rgba(0,0,0,.08);border-radius:calc(var(--cfb-radius,16px)*.5);font-size:1rem;font-family:inherit;background:#fff;color:var(--cfb-text,#1e293b);box-sizing:border-box}' +
      '.cfb-input:focus{outline:none;border-color:var(--cfb-primary,#6366f1)}' +
      '.cfb-buttons{display:flex;flex-direction:column;gap:.5rem;margin-top:.75rem;animation:cfbFadeIn .35s ease .15s both}' +
      '.cfb-btn{display:block;width:100%;padding:.9rem 1rem;border:none;border-radius:calc(var(--cfb-radius,16px)*.5);background:var(--cfb-btn,#6366f1);color:var(--cfb-btn-text,#fff);font-size:1rem;font-weight:600;font-family:inherit;cursor:pointer;transition:transform .12s,opacity .12s;text-align:center;box-sizing:border-box}' +
      '.cfb-btn:hover{opacity:.92;transform:translateY(-1px)}.cfb-btn.selected{outline:2px solid var(--cfb-primary,#6366f1);outline-offset:2px}' +
      '.cfb-btn-cta{background:var(--cfb-cta,#10b981);margin-top:.5rem}.cfb-btn-submit{margin-top:.25rem}' +
      '@keyframes cfbFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}';

    // Inline JS — same logic as renderFunnelWidget but self-contained
    var js =
      '(function(){' +
      'var DATA=' + dataJson + ';' +
      'var state={currentStepId:DATA.startStepId||DATA.steps[0].id,email:"",tags:[],answers:{},selectedMultiple:[],visitedCount:0,completed:false};' +
      'var root=document.getElementById("' + widgetId + '");' +
      'var s=DATA.styles||{};' +
      'root.style.setProperty("--cfb-primary",s.primaryColor||"#6366f1");' +
      'root.style.setProperty("--cfb-bg",s.backgroundColor||"#f8fafc");' +
      'root.style.setProperty("--cfb-text",s.textColor||"#1e293b");' +
      'root.style.setProperty("--cfb-btn",s.buttonColor||"#6366f1");' +
      'root.style.setProperty("--cfb-btn-text",s.buttonTextColor||"#fff");' +
      'root.style.setProperty("--cfb-cta",s.ctaButtonColor||"#10b981");' +
      'root.style.setProperty("--cfb-radius",(s.borderRadius||16)+"px");' +
      'root.style.setProperty("--cfb-font",s.fontFamily||"system-ui,sans-serif");' +
      'root.style.maxWidth=(s.containerWidth||420)+"px";' +
      'function getStep(id){return DATA.steps.find(function(x){return x.id===id});}' +
      'function render(){' +
      'root.innerHTML="";' +
      'var step=getStep(state.currentStepId);if(!step){root.innerHTML="<p>No steps.</p>";return;}' +
      'var w=document.createElement("div");w.className="cfb-widget";' +
      'w.style.setProperty("--cfb-primary",s.primaryColor||"#6366f1");' +
      'w.style.setProperty("--cfb-bg",s.backgroundColor||"#f8fafc");' +
      'w.style.setProperty("--cfb-text",s.textColor||"#1e293b");' +
      'w.style.setProperty("--cfb-btn",s.buttonColor||"#6366f1");' +
      'w.style.setProperty("--cfb-btn-text",s.buttonTextColor||"#fff");' +
      'w.style.setProperty("--cfb-cta",s.ctaButtonColor||"#10b981");' +
      'w.style.setProperty("--cfb-radius",(s.borderRadius||16)+"px");' +
      'w.style.setProperty("--cfb-font",s.fontFamily||"system-ui,sans-serif");' +
      'root.appendChild(w);' +
      'if(DATA.showProgress){var idx=DATA.steps.findIndex(function(x){return x.id===state.currentStepId;});var pct=Math.max(5,Math.round(((idx+1)/DATA.steps.length)*100));' +
      'var pr=document.createElement("div");pr.className="cfb-progress";pr.innerHTML=\'<div class="cfb-progress-bar"><div class="cfb-progress-fill" style="width:\'+pct+\'%"></div></div><div class="cfb-progress-text">Step \'+(idx+1)+" of "+DATA.steps.length+"</div>";w.appendChild(pr);}' +
      'var chat=document.createElement("div");chat.className="cfb-chat-area";w.appendChild(chat);' +
      'function show(){chat.innerHTML="";var cur=getStep(state.currentStepId);if(!cur)return;' +
      'var go=function(){var msg=document.createElement("div");msg.className="cfb-message";' +
      'if(cur.imageUrl){var im=document.createElement("img");im.className="cfb-message-image";im.src=cur.imageUrl;im.alt="";msg.appendChild(im);}' +
      'var t=document.createElement("p");t.className="cfb-message-text";t.textContent=cur.message;msg.appendChild(t);' +
      'if(cur.subtext){var st=document.createElement("p");st.className="cfb-message-subtext";st.textContent=cur.subtext;msg.appendChild(st);}' +
      'chat.appendChild(msg);renderInput(cur);};' +
      'if(cur.delay>0)setTimeout(go,cur.delay);else go();}' +
      'function renderInput(cur){' +
      'if(cur.questionType==="text"||cur.questionType==="email"){' +
      'var ia=document.createElement("div");ia.className="cfb-input-area";' +
      'var inp=document.createElement("input");inp.className="cfb-input";inp.type=cur.questionType==="email"?"email":"text";' +
      'inp.placeholder=cur.questionType==="email"?"Enter your email":"Type your answer…";' +
      'var sub=document.createElement("button");sub.type="button";sub.className="cfb-btn cfb-btn-submit";sub.textContent="Continue";' +
      'sub.onclick=function(){var v=inp.value.trim();if(!v)return; if(cur.questionType==="email")state.email=v; state.answers[cur.id]=v; goNext(cur.options[0]&&cur.options[0].nextStepId);};' +
      'inp.onkeydown=function(e){if(e.key==="Enter")sub.click();};ia.appendChild(inp);ia.appendChild(sub);chat.appendChild(ia);inp.focus();return;}' +
      'if(cur.questionType==="multiple"){' +
      'state.selectedMultiple=state.selectedMultiple||[];var mw=document.createElement("div");mw.className="cfb-buttons";' +
      'cur.options.forEach(function(opt,i){var b=document.createElement("button");b.type="button";b.className="cfb-btn";b.textContent=opt.text;' +
      'if(state.selectedMultiple.indexOf(i)!==-1)b.classList.add("selected");' +
      'b.onclick=function(){var p=state.selectedMultiple.indexOf(i);if(p===-1)state.selectedMultiple.push(i);else state.selectedMultiple.splice(p,1);b.classList.toggle("selected");};mw.appendChild(b);});' +
      'var cb=document.createElement("button");cb.type="button";cb.className="cfb-btn cfb-btn-submit";cb.textContent="Continue";' +
      'cb.onclick=function(){if(!state.selectedMultiple.length)return;state.selectedMultiple.forEach(function(i){if(cur.options[i]&&cur.options[i].tag)state.tags.push(cur.options[i].tag);});' +
      'state.answers[cur.id]=state.selectedMultiple.map(function(i){return cur.options[i].text;});' +
      'goNext(cur.options[state.selectedMultiple[0]]&&cur.options[state.selectedMultiple[0]].nextStepId);};mw.appendChild(cb);chat.appendChild(mw);return;}' +
      'if(cur.options&&cur.options.length){var bw=document.createElement("div");bw.className="cfb-buttons";' +
      'cur.options.forEach(function(opt){var b=document.createElement("button");b.type="button";b.className="cfb-btn";b.textContent=opt.text;' +
      'b.onclick=function(){if(opt.tag)state.tags.push(opt.tag);state.answers[cur.id]=opt.text;goNext(opt.nextStepId);};bw.appendChild(b);});chat.appendChild(bw);}' +
      'if(cur.ctaText){var cw=document.createElement("div");cw.className="cfb-buttons";var cta=document.createElement("button");cta.type="button";cta.className="cfb-btn cfb-btn-cta";cta.textContent=cur.ctaText;' +
      'cta.onclick=function(){if(cur.ctaUrl)window.open(cur.ctaUrl,"_blank");complete();};cw.appendChild(cta);chat.appendChild(cw);}}' +
      'function goNext(nextId){state.selectedMultiple=[];state.visitedCount++;if(!nextId||!getStep(nextId)){complete();return;}state.currentStepId=nextId;show();}' +
      'function complete(){state.completed=true;if(DATA.redirectUrl)setTimeout(function(){window.location.href=DATA.redirectUrl;},600);}' +
      'show();}' +
      'render();' +
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
    initTabs();
    initEvents();
    renderEditor();
    renderPreview();
  }

  init();
})();
