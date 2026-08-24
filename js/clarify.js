(() => {
  const nativeFetch = window.fetch.bind(window);

  function getOrCreateClarifier() {
    let box = document.querySelector('#ai-clarify');
    if (box) return box;

    const heroSearch = document.querySelector('.hero-search');
    if (!heroSearch) return null;

    box = document.createElement('div');
    box.id = 'ai-clarify';
    box.className = 'ai-clarify';
    box.hidden = true;
    box.setAttribute('aria-live', 'polite');
    heroSearch.insertAdjacentElement('afterend', box);
    return box;
  }

  function hideClarifier() {
    const box = document.querySelector('#ai-clarify');
    if (!box) return;
    box.hidden = true;
    box.replaceChildren();
  }

  function applyChoice(choice) {
    const search = document.querySelector('#search');
    const compact = document.querySelector('#compact-search');
    const value = String(choice?.refinement || choice?.label || '').trim();
    if (!value) return;

    if (search) {
      search.value = value;
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (compact) compact.value = value;

    hideClarifier();
    requestAnimationFrame(() => document.querySelector('#hero-submit')?.click());
  }

  function renderClarifier(data) {
    const box = getOrCreateClarifier();
    if (!box) return;

    box.replaceChildren();

    const question = document.createElement('p');
    question.className = 'ai-clarify-question';
    question.textContent = data.clarifying_question || '可以再告訴我你想做哪一種嗎？';
    box.append(question);

    const choices = document.createElement('div');
    choices.className = 'ai-clarify-choices';

    for (const choice of Array.isArray(data.choices) ? data.choices : []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ai-clarify-choice';
      button.textContent = String(choice?.label || '').trim();
      button.addEventListener('click', () => applyChoice(choice));
      choices.append(button);
    }

    if (choices.childElementCount) box.append(choices);
    box.hidden = false;
  }

  function renderNoMatch(data) {
    hideClarifier();

    const grid = document.querySelector('#resource-grid');
    const empty = document.querySelector('#empty-state');
    const count = document.querySelector('#result-count');
    if (!grid || !empty) return;

    grid.replaceChildren();
    if (count) count.textContent = '0';
    empty.hidden = false;

    const title = empty.querySelector('h2');
    const message = empty.querySelector('p');
    if (title) title.textContent = '目前沒有合適的資源';
    if (message) {
      message.textContent = String(data?.missing_capability || '目前資源庫還沒有足夠符合這個需求的工具。');
    }

    document.querySelector('#resources')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function interceptedResponse(code) {
    return new Response(JSON.stringify({ error: code }), {
      status: 409,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);

    try {
      const input = args[0];
      const init = args[1] || {};
      const url = typeof input === 'string' ? input : input?.url || '';
      const method = String(init.method || input?.method || 'GET').toUpperCase();

      if (method === 'POST' && /\/api\/recommend(?:$|[?#])/.test(url)) {
        const data = await response.clone().json();

        if (data?.mode === 'clarify') {
          renderClarifier(data);
          return interceptedResponse('needs_clarification');
        }

        if (data?.mode === 'no_match' || data?.no_match === true) {
          renderNoMatch(data);
          return interceptedResponse('no_matching_resource');
        }

        hideClarifier();
      }
    } catch (error) {
      console.debug('AI response interceptor skipped', error);
    }

    return response;
  };

  for (const selector of ['#search', '#compact-search']) {
    document.querySelector(selector)?.addEventListener('input', hideClarifier);
  }
})();
