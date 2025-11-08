// --- ELEMENTS ---
const STATUS = document.getElementById('status');
const RESULTS = document.getElementById('results');
const INPUT = document.getElementById('inputIngredients');
const BTN = document.getElementById('btnSearch');
const CLEAR = document.getElementById('btnClear');
const MIC = document.getElementById('micBtn');
const SUGGESTIONS = document.createElement('div');
SUGGESTIONS.className = 'suggestions';
INPUT.parentNode.style.position = 'relative';
INPUT.parentNode.appendChild(SUGGESTIONS);

let RECIPES = [];
let allIngredients = new Set();
let CURRENT_RESULTS = []; // ✅ holds last filtered list

// --- NORMALIZE FUNCTION ---
function normalizeRecipe(r) {
  const title = r.title || r.name || r.recipe_name || 'Untitled';
  const image = r.image || r.img || 'https://via.placeholder.com/400x300?text=No+Image';
  let stepsArray = [];

  if (Array.isArray(r.steps) && r.steps.length) stepsArray = r.steps.map(s => String(s).trim());
  else if (Array.isArray(r.instructions) && r.instructions.length) stepsArray = r.instructions.map(s => String(s).trim());
  else if (typeof r.instructions === 'string' && r.instructions.trim())
    stepsArray = r.instructions.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);

  const instructions = stepsArray.join(' ') || r.instructions || '';

  let ingredients = [];
  if (Array.isArray(r.ingredients)) ingredients = r.ingredients.map(i => String(i).trim());
  else if (typeof r.ingredients === 'string')
    ingredients = r.ingredients.split(/[,;\n]/).map(i => i.trim()).filter(Boolean);

  ingredients.forEach(i => allIngredients.add(i.toLowerCase()));

  return { title, image, ingredients, instructions, stepsArray };
}

// --- LOAD RECIPES ---
async function loadRecipes() {
  try {
   // STATUS.textContent = 'Loading recipes...';
    const res = await fetch('./recipe.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    RECIPES = Array.isArray(data)
      ? data.map(normalizeRecipe)
      : Object.values(data).flat().map(normalizeRecipe);

   // STATUS.textContent = `Loaded ${RECIPES.length} recipes 🍲`;
  } catch (err) {
    STATUS.textContent = 'Failed to load recipes ❌';
  }
}

// --- SMART INGREDIENT SUGGESTIONS ---
INPUT.addEventListener('input', () => {
  const value = INPUT.value;
  const cursorPos = INPUT.selectionStart;
  const textBeforeCursor = value.slice(0, cursorPos);

  const parts = textBeforeCursor.split(',').map(p => p.trim());
  const lastWord = parts[parts.length - 1].toLowerCase();

  SUGGESTIONS.innerHTML = '';
  if (!lastWord) return;

  const matches = Array.from(allIngredients)
    .filter(i => i.startsWith(lastWord))
    .slice(0, 5);

  matches.forEach(m => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.textContent = m;
    item.onclick = () => {
      parts[parts.length - 1] = m;
      const newValue = parts.join(', ') + (value.endsWith(',') ? '' : ', ');
      INPUT.value = newValue;
      SUGGESTIONS.innerHTML = '';
      INPUT.focus();
      INPUT.setSelectionRange(newValue.length, newValue.length);
    };
    SUGGESTIONS.appendChild(item);
  });
});

document.addEventListener('click', e => {
  if (!SUGGESTIONS.contains(e.target) && e.target !== INPUT) {
    SUGGESTIONS.innerHTML = '';
  }
});

// --- SEARCH FUNCTION ---
function searchAndRender() {
  const q = INPUT.value.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  if (!q.length) {
    RESULTS.innerHTML = '<div class="no-results">Please enter ingredients</div>';
    return;
  }

  const results = RECIPES.map(r => {
    const matched = r.ingredients.filter(i => q.some(qt => i.toLowerCase().includes(qt)));
    const score = matched.length / Math.max(1, r.ingredients.length);
    return { ...r, score, matched };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);

  CURRENT_RESULTS = results; // ✅ save filtered list
  renderResults(results);
}

// --- RENDER RESULTS ---
function renderResults(results) {
  if (!results.length) {
    RESULTS.innerHTML = '<div class="no-results">No recipes found 😔</div>';
    return;
  }

  RESULTS.innerHTML = results.map((r, index) => `
    <div class="card" data-idx="${index}">
      <img src="${r.image}" alt="${r.title}" class="recipe-img" />
      <div class="card-content">
        <div class="meta">
          <span class="badge">${Math.round(r.score * 100)}%</span>
          <span>${r.ingredients.length} ingredients</span>
        </div>
        <h3 class="recipe-title">${r.title}</h3>
        <p><strong>Ingredients:</strong> ${r.ingredients.join(', ')}</p>
        <p><strong>Matched:</strong> ${r.matched.join(', ') || '—'}</p>
        <div class="instructions" style="display:none;"></div>
        <button class="view-instr-btn" data-idx="${index}">View Instructions</button>
      </div>
    </div>
  `).join('');
}

// --- INSTRUCTION TOGGLE + VOICE OUTPUT ---
RESULTS.addEventListener('click', ev => {
  const btn = ev.target.closest('.view-instr-btn');
  if (!btn) return;

  const card = btn.closest('.card');
  const idx = Number(btn.getAttribute('data-idx'));
  const recipe = CURRENT_RESULTS[idx]; // ✅ Use filtered result, not RECIPES
  const instEl = card.querySelector('.instructions');

  if (instEl.style.display === 'block') {
    instEl.style.display = 'none';
    btn.textContent = 'View Instructions';
    window.speechSynthesis.cancel();
    return;
  }

  const stepsHtml = recipe.stepsArray.length
    ? '<ol>' + recipe.stepsArray.map(s => `<li>${s}</li>`).join('') + '</ol>'
    : `<p>${recipe.instructions}</p>`;

  instEl.innerHTML = stepsHtml;
  instEl.style.display = 'block';
  btn.textContent = 'Hide Instructions';

  const speech = new SpeechSynthesisUtterance(recipe.instructions);
  speech.lang = 'en-IN';
  speech.rate = 1.0;
  window.speechSynthesis.speak(speech);
});

// --- VOICE INPUT ---
MIC.addEventListener('click', () => {
  if (!('webkitSpeechRecognition' in window)) {
    alert('Speech recognition not supported.');
    return;
  }

  const recognition = new webkitSpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.start();
  MIC.classList.add('listening');

  recognition.onresult = e => {
    const transcript = e.results[0][0].transcript;
    INPUT.value = transcript;
    MIC.classList.remove('listening');
  };
  recognition.onerror = () => MIC.classList.remove('listening');
  recognition.onend = () => MIC.classList.remove('listening');
});

// --- CLEAR BUTTON ---
CLEAR.addEventListener('click', () => {
  INPUT.value = '';
  RESULTS.innerHTML = '';
  STATUS.textContent = '';
  SUGGESTIONS.innerHTML = '';
  window.speechSynthesis.cancel();
  CURRENT_RESULTS = [];
});

// --- INITIAL LOAD ---
BTN.addEventListener('click', searchAndRender);
loadRecipes();
// --- AUTOCOMPLETE INGREDIENT SUGGESTIONS ---
INPUT.addEventListener('input', () => {
  const value = INPUT.value;
  const cursorPos = INPUT.selectionStart;
  const textBeforeCursor = value.slice(0, cursorPos);

  const parts = textBeforeCursor.split(',').map(p => p.trim());
  const lastWord = parts[parts.length - 1].toLowerCase();

  SUGGESTIONS.innerHTML = '';
  if (!lastWord) return;

  const matches = Array.from(allIngredients)
    .filter(i => i.startsWith(lastWord))
    .slice(0, 6);

  if (!matches.length) return;

  matches.forEach(m => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.textContent = m;
    item.onclick = () => {
      parts[parts.length - 1] = m;
      const newValue = parts.join(', ') + (value.endsWith(',') ? '' : ', ');
      INPUT.value = newValue;
      SUGGESTIONS.innerHTML = '';
      INPUT.focus();
      INPUT.setSelectionRange(newValue.length, newValue.length);
    };
    SUGGESTIONS.appendChild(item);
  });
});

document.addEventListener('click', e => {
  if (!SUGGESTIONS.contains(e.target) && e.target !== INPUT) {
    SUGGESTIONS.innerHTML = '';
  }
});
