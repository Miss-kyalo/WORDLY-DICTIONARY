document.addEventListener('DOMContentLoaded', () => {
    
    const $ = selector => document.getElementById(selector);
    const UI = {
        form: $('search-form'),
        input: $('search-input'),
        canvas: $('result-container'),
        title: $('word-title'),
        phonetic: $('word-pronunciation'),
        flow: $('meanings-container'),
        error: $('error-message'),
        loader: $('loader'),
        theme: $('theme-toggle'),
        audio: $('audio-button'),
        source: $('source-container'),
        vault: $('save-button'),
        box: $('favorites-container')
    };

    const API_ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
    let liveAudioStream = null, cachedDataNode = null;

    const synchronizeDisplayTheme = (shouldEnableDarkMode) => {
        document.body.classList.toggle('dark-theme', shouldEnableDarkMode);
        document.body.classList.toggle('light-theme', !shouldEnableDarkMode);
        UI.theme.textContent = shouldEnableDarkMode ? 'Switch Theme (Light)' : 'Switch Theme';
        localStorage.setItem('wordly-theme', shouldEnableDarkMode ? 'dark' : 'light');
    };
    synchronizeDisplayTheme(localStorage.getItem('wordly-theme') === 'dark');
    UI.theme?.addEventListener('click', () => synchronizeDisplayTheme(!document.body.classList.contains('dark-theme')));

    const getSavedCollection = () => JSON.parse(localStorage.getItem('wordly-favorites')) || [];
    
    const refreshVocabularyPanel = () => {
        if (!UI.box) return;
        const currentSavedList = getSavedCollection();
        UI.box.innerHTML = '';
        
        if (!currentSavedList.length) {
            UI.box.innerHTML = '<p class="text-muted fst-italic empty-msg">No favorite words saved yet.</p>';
            return;
        }

        currentSavedList.sort().forEach(vocabularyWord => {
            const dynamicBadgeWrapper = document.createElement('div');
            dynamicBadgeWrapper.className = 'btn-group btn-group-sm m-1';
            dynamicBadgeWrapper.innerHTML = `
                <button type="button" class="btn btn-outline-primary text-capitalize font-weight-bold fav-link">${vocabularyWord}</button>
                <button type="button" class="btn btn-primary remove-fav-btn" title="Remove ${vocabularyWord}">&times;</button>
            `;
            
            dynamicBadgeWrapper.querySelector('.fav-link').onclick = () => { UI.input.value = vocabularyWord; executeDataQuery(vocabularyWord); };
            dynamicBadgeWrapper.querySelector('.remove-fav-btn').onclick = () => removeTermFromCollection(vocabularyWord);
            UI.box.appendChild(dynamicBadgeWrapper);
        });
    };

    const toggleVaultButtonVisuals = (wordTerm) => {
        if (!UI.vault) return;
        const isTermSaved = getSavedCollection().includes(wordTerm.toLowerCase());
        
        if (isTermSaved) {
            UI.vault.textContent = 'Saved ★';
            UI.vault.className = 'btn btn-success btn-sm';
        } else {
            UI.vault.textContent = 'Save Word';
            UI.vault.className = 'btn btn-outline-success btn-sm';
        }
    };

    UI.vault?.addEventListener('click', () => {
        if (!cachedDataNode) return;
        const key = cachedDataNode.word.toLowerCase();
        let collection = getSavedCollection();
        collection = collection.includes(key) ? collection.filter(item => item !== key) : [...collection, key];
        localStorage.setItem('wordly-favorites', JSON.stringify(collection));
        toggleVaultButtonVisuals(key);
        refreshVocabularyPanel();
    });

    const removeTermFromCollection = (wordTerm) => {
        localStorage.setItem('wordly-favorites', JSON.stringify(getSavedCollection().filter(item => item !== wordTerm.toLowerCase())));
        refreshVocabularyPanel();
        if (cachedDataNode?.word.toLowerCase() === wordTerm.toLowerCase()) toggleVaultButtonVisuals(wordTerm);
    };

    UI.form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const query = UI.input.value.trim();
        if (query) {
            await executeDataQuery(query);
        }
    });

    UI.audio?.addEventListener('click', () => {
        if (liveAudioStream) {
            liveAudioStream.play().catch(() => {
                UI.error.textContent = 'Alas, the audio file seems to be unavailable.';
                UI.error.style.display = 'block';
            });
        }
    });

    async function executeDataQuery(queryTextValue) {
        UI.canvas.style.display = 'none'; UI.error.style.display = 'none'; UI.loader.style.display = 'block';
        try {
            const securePayloadUrl = `${API_ENDPOINT}${encodeURIComponent(queryTextValue.trim().toLowerCase())}`;
            const serverResponse = await fetch(securePayloadUrl);
            
            if (!serverResponse.ok) {
                throw new Error('OOPS! Our directory could not find that word. It might be too cool or made up.');
            }
            const rawJson = await serverResponse.json();
            renderDictionaryCanvas(rawJson[0], rawJson);
        } catch (error) {
            UI.error.textContent = error.message; UI.error.style.display = 'block';
        } finally {
            UI.loader.style.display = 'none';
        }
    }

    function renderDictionaryCanvas(primaryDataObject, fullDataArray) {
        cachedDataNode = primaryDataObject;
        UI.title.textContent = primaryDataObject.word;
        toggleVaultButtonVisuals(primaryDataObject.word);

        const parsedPhoneticString = primaryDataObject.phonetic || fullDataArray.find(e => e.phonetic)?.phonetic || fullDataArray.flatMap(e => e.phonetics || []).find(p => p.text)?.text || '';
        UI.phonetic.textContent = parsedPhoneticString;
        UI.phonetic.style.display = parsedPhoneticString ? 'block' : 'none';

        UI.flow.innerHTML = ''; UI.audio.style.display = 'none'; liveAudioStream = null;

        const extractedAudioUrl = fullDataArray.flatMap(e => e.phonetics || []).find(p => p.audio && p.audio.trim() !== '')?.audio;
        if (extractedAudioUrl) {
            liveAudioStream = new Audio(extractedAudioUrl);
            UI.audio.style.display = 'inline-flex';
        }

        primaryDataObject.meanings.forEach(meaningNode => {
            const nodeWrapperDiv = document.createElement('div');
            nodeWrapperDiv.className = 'meaning-block mb-4 pt-3 border-top';
            
            let structuralMarkupBuffer = `<h4 class="text-primary text-capitalize h5 mb-2">${meaningNode.partOfSpeech}</h4>`;
            meaningNode.definitions.forEach((definitionItem, indexMarker) => {
                structuralMarkupBuffer += `<p class="mb-1"><strong>${indexMarker + 1}.</strong> ${definitionItem.definition}</p>`;
                if (definitionItem.example) {
                    structuralMarkupBuffer += `<p class="fst-italic text-muted ms-3 small">Example: "${definitionItem.example}"</p>`;
                }
            });

            let pooledSynonyms = meaningNode.synonyms ? [...meaningNode.synonyms] : [];
            meaningNode.definitions.forEach(d => { if (d.synonyms) pooledSynonyms = [...pooledSynonyms, ...d.synonyms]; });
            const isolatedUniqueSynonyms = [...new Set(pooledSynonyms)];

            if (isolatedUniqueSynonyms.length > 0) {
                structuralMarkupBuffer += `
         <div class="mt-2 small">
        <strong class="text-secondary">Synonyms:</strong> 
      ${isolatedUniqueSynonyms.slice(0, 5).map(syn => `<span class="badge bg-secondary me-1 text-capitalize">${syn}</span>`).join('')}
                    </div>`;
            }
            nodeWrapperDiv.innerHTML = structuralMarkupBuffer;
            UI.flow.appendChild(nodeWrapperDiv);
        });

        if (UI.source) {
            const webSourceProvenanceUrl = primaryDataObject.sourceUrls ? primaryDataObject.sourceUrls[0] : `https://wiktionary.org{primaryDataObject.word}`;
            UI.source.innerHTML = `<span>Source Details: </span>
            <a href="${webSourceProvenanceUrl}" target="_blank" rel="noopener noreferrer" class="text-decoration-underline text-reset">${webSourceProvenanceUrl}</a>`;
            UI.source.style.display = 'block';
        }
        UI.canvas.style.display = 'block';
    }

    refreshVocabularyPanel();
});
