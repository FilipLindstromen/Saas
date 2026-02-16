import React, { useState } from 'react'
import './ExportButton.css'

function ExportButton({ quizData }) {
  const [copied, setCopied] = useState(false)

  const generateCode = () => {
    const questionsCode = quizData.questions.map(q => {
      const answersCode = q.answers.map(a => 
        `          { label: ${JSON.stringify(a.label)}, tag: ${JSON.stringify(a.tag)} }`
      ).join(',\n')
      return `      {\n        q: ${JSON.stringify(q.q)},\n        answers: [\n${answersCode}\n        ]\n      }`
    }).join(',\n')

    const tagLabelsCode = Object.entries(quizData.tagLabels)
      .map(([key, value]) => `      ${key}: ${JSON.stringify(value)}`)
      .join(',\n')

    const headlinesCode = Object.entries(quizData.headlines)
      .map(([key, value]) => `      ${key}: ${JSON.stringify(value)}`)
      .join(',\n')

    const tagInsightsCode = Object.entries(quizData.tagInsights)
      .map(([key, value]) => `      ${key}: ${JSON.stringify(value)}`)
      .join(',\n')

    const ctaCode = Object.entries(quizData.cta)
      .map(([key, value]) => `      ${key}: ${JSON.stringify(value)}`)
      .join(',\n')

    return `<!-- ✅ GOOGLE FONTS -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Oswald:wght@500;700&display=swap" rel="stylesheet">

<div id="quizApp"></div>

<style>
:root { color-scheme: dark; }

html, body {
  margin: 0;
  padding: 0;
  height: 100dvh;
  font-family: 'Inter', sans-serif;
  color: #fff;
  overflow: hidden;
  background: #00080d;
  background: linear-gradient(333deg, rgba(0, 8, 13, 1) 0%, rgba(18, 45, 61, 1) 35%, rgba(10, 75, 92, 1) 100%);
}

#quizApp { height: 100%; }

/* ===== SCALE WRAPPER ===== */
.quiz-scale {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* ===== TITLE SCREEN ===== */
.title-screen {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
}

.title-screen h1 {
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 2.4rem;
  margin-bottom: 14px;
  line-height: 1.2;
}

.title-screen p {
  max-width: 520px;
  opacity: 0.85;
  font-size: 1.05rem;
  margin-bottom: 36px;
  white-space: pre-line;
}

.start-btn {
  padding: 18px 40px;
  font-size: 1.1rem;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  background: #fff;
  color: #000;
  font-weight: 700;
}

/* ===== QUIZ LAYOUT ===== */
.quiz-screen {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: center;
  align-items: center;
}

.progress {
  text-align: center;
  opacity: 0.7;
  margin-bottom: 14px;
}

.question-text {
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 1.85rem;
  text-align: center;
  margin: 0 auto 32px;
  padding: 0 20px;
}

/* CENTER BLOCK */
.quiz-center {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.wheel-wrap {
  position: relative;
  width: 100%;
  max-width: 720px;
  height: 340px;
}

.wheel {
  height: 100%;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.wheel::-webkit-scrollbar { display: none; }

.spacer { height: 140px; }

.answer {
  scroll-snap-align: center;
  text-align: center;
  padding: 30px 0;
  opacity: 0.45;
  font-size: 0.95rem;
  font-weight: 500;
  transition: .2s;
  cursor: pointer;
  user-select: none;
}

.answer.active {
  opacity: 1;
  font-size: 1.15rem;
  font-weight: 700;
}

.selector-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 88%;
  height: 100px;
  border-radius: 999px;
  border: 2.5px solid rgba(255,255,255,.9);
  pointer-events: none;
  z-index: 3;
}

.fade {
  background: none;
}

.fade.bottom { bottom: 0; transform: rotate(180deg); }

/* ===== NEXT BUTTON ===== */
.next-btn {
  position: fixed;
  bottom: 64px;
  left: 50%;
  transform: translateX(-50%);
  width: 78px;
  height: 78px;
  border-radius: 50%;
  border: none;
  background: #fff;
  color: #000;
  font-size: 1.7rem;
  cursor: pointer;
  z-index: 999;
}

/* ===== DESKTOP SCALE ===== */
@media (min-width: 1024px) {
  .quiz-scale {
    transform: scale(2);
    transform-origin: top center;
  }
  .next-btn {
    transform: translateX(-50%) scale(2);
  }
}

/* ===== RESULT SCREEN (NEW STYLE) ===== */
.result-screen {
  display: block !important;
  min-height: 100vh;
  padding: 48px 24px 120px;
  overflow-y: auto;
  background: transparent;
}

.result-container {
  max-width: 600px;
  margin: 0 auto;
}

.result-title {
  font-size: 1.7rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 6px;
}

.result-subtitle {
  text-align: center;
  opacity: 0.8;
  margin-bottom: 28px;
  font-size: 0.95rem;
}

.result-card {
  background: rgba(255,255,255,0.06);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 22px;
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
}

.result-card h3 {
  margin: 0 0 14px;
  font-size: 1rem;
  font-weight: 600;
  opacity: 0.9;
}

.result-body {
  white-space: pre-line;
  line-height: 1.55;
  opacity: 0.9;
  font-size: 0.9rem;
}

.resource-item {
  display: flex;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.resource-item:last-child {
  border-bottom: none;
}

.resource-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(255,255,255,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 14px;
}

.resource-item span {
  flex-grow: 1;
  font-size: 0.9rem;
  line-height: 1.3;
}

.resource-item a {
  opacity: 0.7;
  margin-left: 8px;
  font-size: 1rem;
}

.result-cta {
  margin-top: 10px;
  width: 100%;
  display: block;
  padding: 16px;
  background: #ff9f2b;
  color: #000;
  font-weight: 700;
  border-radius: 12px;
  text-align: center;
  font-size: 1rem;
  transition: 0.2s;
  border: none;
}

.result-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(255,159,43,0.4);
}

.result-close {
  position: absolute;
  top: 24px;
  right: 24px;
  font-size: 1.6rem;
  opacity: 0.7;
  cursor: pointer;
}

.result-close:hover { opacity: 1; }
</style>

<script>
(() => {
  const content = {
    quizTitle: ${JSON.stringify(quizData.quizTitle)},
    quizSubtitle: ${JSON.stringify(quizData.quizSubtitle)},
    questions: [
${questionsCode}
    ],
    tagLabels: {
${tagLabelsCode}
    },
    headlines: {
${headlinesCode}
    },
    tagInsights: {
${tagInsightsCode}
    },
    summary: ${JSON.stringify(quizData.summary)},
    cta: {
${ctaCode}
    }
  };

  const questions = content.questions || [];
  let step = 0;
  let selectedTags = [];
  let worstTag = null;

  const app = document.getElementById("quizApp");

  function showTitle(){
    const titleHtml = content.quizTitle.replace(/\\n/g, "<br>");
    app.innerHTML = \`
      <div class="quiz-scale">
        <div class="title-screen">
          <h1>\${titleHtml}</h1>
          <p>\${content.quizSubtitle}</p>
          <button class="start-btn" id="startQuiz">START THE QUIZ</button>
        </div>
      </div>
    \`;
    document.getElementById("startQuiz").onclick = () => {
      step = 0;
      selectedTags = [];
      worstTag = null;
      renderQuestion();
    };
  }

  function renderQuestion(){
    const q = questions[step];
    if(!q){ showResult(); return; }

    const answersHTML = q.answers.map(a =>
      \`<div class="answer" data-tag="\${a.tag || ""}">\${a.label}</div>\`
    ).join("");

    app.innerHTML = \`
      <div class="quiz-scale">
        <div class="quiz-screen">
          <div class="progress">\${step+1}/\${questions.length}</div>
          <div class="question-text">\${q.q}</div>
          <div class="quiz-center">
            <div class="wheel-wrap">
              <div class="fade"></div>
              <div class="wheel" id="wheel">
                <div class="spacer"></div>
                \${answersHTML}
                <div class="spacer"></div>
              </div>
              <div class="selector-frame"></div>
              <div class="fade bottom"></div>
            </div>
          </div>
        </div>
      </div>
      <button class="next-btn" id="nextBtn">→</button>
    \`;

    const wheel = document.getElementById("wheel");

    requestAnimationFrame(() => {
      const first = wheel.querySelector(".answer");
      if (!first) return;
      const spacerH = (wheel.clientHeight/2) - (first.clientHeight/2);
      wheel.querySelectorAll(".spacer").forEach(s => s.style.height = spacerH + "px");
      wheel.scrollTop = first.offsetTop - spacerH;
      updateActive(wheel);
    });

    wheel.onscroll = () => updateActive(wheel);
    wheel.onclick = e => {
      const t = e.target.closest(".answer");
      if(t) centerOn(wheel, t);
    };

    document.getElementById("nextBtn").onclick = goNext;
  }

  function centerOn(wheel, el){
    const top = el.offsetTop - (wheel.clientHeight/2 - el.clientHeight/2);
    wheel.scrollTo({ top, behavior: "smooth" });
  }

  function updateActive(wheel){
    const items = [...wheel.querySelectorAll(".answer")];
    if (!items.length) return;
    const center = wheel.scrollTop + wheel.clientHeight/2;
    let closest = items[0];
    let dist = Infinity;
    items.forEach(el => {
      const y = el.offsetTop + el.clientHeight/2;
      const d = Math.abs(y - center);
      if(d < dist){ dist = d; closest = el; }
    });
    items.forEach(el => el.classList.remove("active"));
    closest.classList.add("active");
  }

  function goNext(){
    const active = document.querySelector(".answer.active");
    if(!active) return;
    const tag = active.dataset.tag;
    if(tag && !selectedTags.includes(tag)){
      selectedTags.push(tag);
    }
    if(step === 2){
      worstTag = tag;
    }
    step++;
    (step < questions.length) ? renderQuestion() : showResult();
  }

  function showResult(){
    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "auto";
    if (!selectedTags.length) selectedTags = ["default"];
    const dominantTag = selectedTags[0];
    const labels = content.tagLabels || {};
    const headlines = content.headlines || {};
    const insights = content.tagInsights || {};
    const ctas = content.cta || {};
    const headline = headlines[dominantTag] || headlines.default;
    const cta = ctas[dominantTag] || ctas.default;
    const worstLabel = labels[worstTag] || labels.default;
    const mindTags = new Set(["racingMind","thinking","lossOfControl","random","social","nighttime"]);
    const bodyTags = new Set(["body","cortisol","pressure","avoidance","presence"]);
    let mindText = "";
    let bodyText = "";
    let extraText = "";
    selectedTags.forEach(tag => {
      const block = insights[tag];
      if (!block) return;
      if (mindTags.has(tag)) mindText += (mindText ? "\\n\\n" : "") + block;
      else if (bodyTags.has(tag)) bodyText += (bodyText ? "\\n\\n" : "") + block;
      else extraText += (extraText ? "\\n\\n" : "") + block;
    });
    const feelsText = \`For you, anxiety hits hardest as **\${worstLabel}**.\\n\\nThat's the part your system turns up the loudest when it feels overwhelmed — which is why it can feel so intense, so fast, and so hard to switch off.\\n\`.trim();
    let nextStepsText = feelsText;
    if (mindText) nextStepsText += \`\\n\\n\${mindText}\`;
    if (bodyText) nextStepsText += \`\\n\\n\${bodyText}\`;
    if (extraText) nextStepsText += \`\\n\\n\${extraText}\`;
    nextStepsText += \`\\n\\n\${content.summary}\`;
    app.innerHTML = \`
<div class="quiz-scale result-noscale result-screen">
  <div class="result-container">
    <div class="result-close">×</div>
    <div class="result-title">\${headline}</div>
    <div class="result-subtitle">Here's what your answers reveal.</div>
    <div class="result-card">
      <h3>Your Pattern</h3>
      <div class="result-body">\${feelsText}</div>
    </div>
    <div class="result-card">
      <h3>Next Steps</h3>
      <div class="result-body">\${nextStepsText}</div>
    </div>
    <button class="result-cta">\${cta}</button>
  </div>
</div>\`;
  }

  showTitle();
})();
</script>`
  }

  const handleExport = () => {
    const code = generateCode()
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(err => {
      console.error('Failed to copy:', err)
      // Fallback: show in alert or textarea
      const textarea = document.createElement('textarea')
      textarea.value = code
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="export-section">
      <h2>Export Quiz</h2>
      <p className="section-description">
        Generate the complete HTML/JavaScript code for your quiz. The code will be copied to your clipboard.
      </p>
      <button
        onClick={handleExport}
        className="btn-primary btn-export"
      >
        {copied ? '✓ Copied to Clipboard!' : '📋 Export Quiz Code'}
      </button>
    </div>
  )
}

export default ExportButton

