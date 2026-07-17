document.addEventListener('DOMContentLoaded', () => {
    
    const $ = selector => document.getElementById(selector);
    const UI = {
        form: $('search-form'),
        input: $('search-input'),
        canvas: $('result-card'),
        title: $('word-heading'),
        phonetic: $('pronunciation-text'),
        flow: $('meanings-container'),
        error: $('error-banner'),
        loader: $('loading-spinner'),
        theme: $('theme-toggle'),
        audio: $('audio-playback-btn'),
        source: $('source-link-container'),
        vault: $('save-word-btn'),
        box: $('favorites-container')
    };

    const API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
    let currentAudio = null, currentWord = null;

    const toggleTheme = (isDark) => {
        document.body.classList.toggle('dark-theme', isDark);
        document.body.classList.toggle('light-theme', !isDark);
        UI.theme.textContent = isDark ? 'Switch Theme (Light)' : 'Switch Theme';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    };
    toggleTheme(localStorage.getItem('theme') === 'dark');
    UI.theme?.addEventListener('click', () => toggleTheme(!document.body.classList.contains('dark-theme')));

    const getFavorites = () => JSON.parse(localStorage.getItem('favorites')) || [];
    
    const renderFavorites = () => {
        if (!UI.box) return;
        const list = getFavorites();
        UI.box.innerHTML = '';
        
        if (!list.length) {
            UI.box.innerHTML = '<p class="text-muted fst-italic empty-msg">No favorite words saved yet.</p>';
            return;
        }

        list.sort().forEach(word => {
            const badge = document.createElement('div');
            badge.className = 'favorite-item btn-group btn-group-sm m-1 d-inline-flex align-items-center';
            badge.innerHTML = `
                <button type="button" class="btn btn-link text-capitalize p-0 me-2 text-decoration-none fw-bold fav-link" style="color: var(--text-color);">${word}</button>
                <button type="button" class="btn-close remove-fav-btn" aria-label="Remove ${word}" style="font-size: 0.65rem;"></button>
            `;
            
            badge.querySelector('.fav-link').onclick = () => { UI.input.value = word; fetchWord(word); };
            badge.querySelector('.remove-fav-btn').onclick = () => removeFavorite(word);
            UI.box.appendChild(badge);
        });
    };

    const updateSaveButton = (word) => {
        if (!UI.vault) return;
        const isSaved = getFavorites().includes(word.toLowerCase());
        
        if (isSaved) {
            UI.vault.textContent = 'Saved ★';
            UI.vault.className = 'btn btn-sm saved-word-highlight';
        } else {
            UI.vault.textContent = 'Save Word';
            UI.vault.className = 'btn btn-outline-success btn-sm';
        }
    };

    UI.vault?.addEventListener('click', () => {
        if (!currentWord) return;
        const word = currentWord.word.toLowerCase();
        let list = getFavorites();
        list = list.includes(word) ? list.filter(item => item !== word) : [...list, word];
        localStorage.setItem('favorites', JSON.stringify(list));
        updateSaveButton(word);
        renderFavorites();
    });

    const removeFavorite = (word) => {
        localStorage.setItem('favorites', JSON.stringify(getFavorites().filter(item => item !== word.toLowerCase())));
        renderFavorites();
        if (currentWord?.word.toLowerCase() === word.toLowerCase()) updateSaveButton(word);
    };

    UI.form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = UI.input.value.trim();
        if (query) {
            await fetchWord(query);
        }
    });

    UI.audio?.addEventListener('click', () => {
        if (currentAudio) {
            currentAudio.play().catch(() => {
                UI.error.textContent = 'Audio file is unavailable.';
                UI.error.style.display = 'block';
            });
        }
    });

    async function fetchWord(wordQuery) {
        UI.canvas.style.display = 'none'; UI.error.style.display = 'none'; UI.loader.style.display = 'block';
        try {
            const url = `${API_URL}${encodeURIComponent(wordQuery.trim().toLowerCase())}`;
            const res = await fetch(url);
            
            if (!res.ok) {
                throw new Error('Word not found in database. Please check your spelling.');
            }
            const data = await res.json();
            renderResult(data[0]);
        } catch (err) {
            UI.error.textContent = err.message; UI.error.style.display = 'block';
        } finally {
            UI.loader.style.display = 'none';
        }
    }

    function renderResult(wordData) {
        currentWord = wordData;
        UI.title.textContent = wordData.word;
        updateSaveButton(wordData.word);

        const phonetic = wordData.phonetic || '';
        UI.phonetic.textContent = phonetic;
        UI.phonetic.style.display = phonetic ? 'block' : 'none';

        UI.flow.innerHTML = ''; UI.audio.style.display = 'none'; currentAudio = null;

        const audioUrl = (wordData.phonetics || []).find(p => p.audio && p.audio.trim() !== '')?.audio;
        if (audioUrl) {
            currentAudio = new Audio(audioUrl);
            UI.audio.style.display = 'inline-flex';
        }

        wordData.meanings.forEach(meaning => {
            const block = document.createElement('div');
            block.className = 'meaning-block mb-4 pt-3 border-top';
            
            let html = `<h4 class="text-primary text-capitalize h5 mb-2">${meaning.partOfSpeech}</h4>`;
            meaning.definitions.forEach((def, index) => {
                html += `<p class="mb-1"><strong>${index + 1}.</strong> ${def.definition}</p>`;
                if (def.example) {
                    html += `<p class="fst-italic text-muted ms-3 small">Example: "${def.example}"</p>`;
                }
            });

            let synonyms = meaning.synonyms ? [...meaning.synonyms] : [];
            if (synonyms.length > 0) {
                html += `
                    <div class="mt-2 small">
                        <strong class="text-secondary">Synonyms:</strong> 
                        ${synonyms.slice(0, 5).map(syn => `<span class="badge bg-secondary me-1 text-capitalize">${syn}</span>`).join('')}
                    </div>`;
            }
            block.innerHTML = html;
            UI.flow.appendChild(block);
        });

        if (UI.source) {
            const sourceUrl = wordData.sourceUrls ? wordData.sourceUrls[0] : `https://wiktionary.org{wordData.word}`;
            UI.source.innerHTML = `<span>Source: </span>
            <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="text-decoration-underline text-reset">${sourceUrl}</a>`;
            UI.source.style.display = 'block';
        }
        UI.canvas.style.display = 'block';
    }

    renderFavorites();
});
