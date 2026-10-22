let bibleData = null;
let currentBookId = "GEN";
let currentChapter = 1;
let currentTestament = "OT";
let currentThemeIndex = 0;
const themes = ['light', 'sepia', 'dark'];

// Inisialisasi Aplikasi & Fetch Database JSON
async function initApp() {
    try {
        const response = await fetch('./data/bible_db.json');
        if (!response.ok) throw new Error("Gagal mengunduh file JSON");
        
        bibleData = await response.json();
        
        populateBookSelectors();
        renderSidebarBooks();
        renderPassage();
    } catch (err) {
        console.error("Error loading JSON:", err);
        document.getElementById('verses-container').innerHTML = `
            <div class="p-6 bg-red-500/10 border border-red-500/30 text-red-600 rounded-2xl text-center space-y-2">
                <div class="font-bold">Gagal Memuat Database Alkitab</div>
                <p class="text-xs">Pastikan file <b>data/bible_db.json</b> berada di dalam folder yang benar.</p>
            </div>
        `;
    }

    document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('-translate-x-full');
    });
}

function populateBookSelectors() {
    const select = document.getElementById('book-select');
    select.innerHTML = '';
    bibleData.books.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.innerText = b.name;
        select.appendChild(opt);
    });
    updateChapterSelector();
}

function updateChapterSelector() {
    const select = document.getElementById('chapter-select');
    select.innerHTML = '';
    const book = bibleData.books.find(b => b.id === currentBookId);
    for (let i = 1; i <= book.totalChapters; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = `Pasal ${i}`;
        select.appendChild(opt);
    }
}

function switchTestament(testament) {
    currentTestament = testament;
    document.getElementById('tab-ot').className = testament === 'OT' ? 'flex-1 py-2.5 text-center border-b-2 border-amber-600 text-amber-600 font-bold' : 'flex-1 py-2.5 text-center border-b-2 border-transparent text-gray-500';
    document.getElementById('tab-nt').className = testament === 'NT' ? 'flex-1 py-2.5 text-center border-b-2 border-amber-600 text-amber-600 font-bold' : 'flex-1 py-2.5 text-center border-b-2 border-transparent text-gray-500';
    renderSidebarBooks();
}

function renderSidebarBooks() {
    const container = document.getElementById('sidebar-book-list');
    container.innerHTML = '';
    bibleData.books.filter(b => b.testament === currentTestament).forEach(b => {
        const btn = document.createElement('button');
        btn.className = `w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition flex justify-between items-center ${b.id === currentBookId ? 'bg-amber-500/10 text-amber-600 font-bold' : 'hover:bg-black/5 dark:hover:bg-white/5'}`;
        btn.innerHTML = `<span>${b.name}</span> <span class="text-xs text-gray-400 font-normal">${b.totalChapters} pas.</span>`;
        btn.onclick = () => {
            currentBookId = b.id;
            currentChapter = 1;
            document.getElementById('book-select').value = b.id;
            updateChapterSelector();
            renderPassage();
        };
        container.appendChild(btn);
    });
}

function filterSidebarBooks(query) {
    const q = query.toLowerCase();
    const container = document.getElementById('sidebar-book-list');
    container.innerHTML = '';
    bibleData.books.filter(b => b.name.toLowerCase().includes(q)).forEach(b => {
        const btn = document.createElement('button');
        btn.className = `w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition flex justify-between items-center ${b.id === currentBookId ? 'bg-amber-500/10 text-amber-600 font-bold' : 'hover:bg-black/5 dark:hover:bg-white/5'}`;
        btn.innerHTML = `<span>${b.name}</span> <span class="text-xs text-gray-400 font-normal">${b.totalChapters} pas.</span>`;
        btn.onclick = () => {
            currentBookId = b.id;
            currentChapter = 1;
            document.getElementById('book-select').value = b.id;
            updateChapterSelector();
            renderPassage();
        };
        container.appendChild(btn);
    });
}

function onBookChange() {
    currentBookId = document.getElementById('book-select').value;
    currentChapter = 1;
    updateChapterSelector();
    renderPassage();
}

function onChapterChange() {
    currentChapter = parseInt(document.getElementById('chapter-select').value);
    renderPassage();
}

function prevChapter() {
    if (currentChapter > 1) {
        currentChapter--;
        document.getElementById('chapter-select').value = currentChapter;
        renderPassage();
    }
}

function nextChapter() {
    const book = bibleData.books.find(b => b.id === currentBookId);
    if (currentChapter < book.totalChapters) {
        currentChapter++;
        document.getElementById('chapter-select').value = currentChapter;
        renderPassage();
    }
}

function renderPassage() {
    const book = bibleData.books.find(b => b.id === currentBookId);
    document.getElementById('passage-title').innerText = `${book.name} ${currentChapter}`;

    const container = document.getElementById('verses-container');
    container.innerHTML = '';

    const passageVerses = bibleData.verses[currentBookId] && bibleData.verses[currentBookId][currentChapter];

    if (!passageVerses || passageVerses.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-gray-400 space-y-2">
                <i class="fa-solid fa-file-circle-exclamation text-3xl mb-2"></i>
                <p>Teks untuk ${book.name} ${currentChapter} belum dimasukkan ke dalam file JSON database.</p>
            </div>
        `;
        return;
    }

    const isOT = book.testament === 'OT';

    passageVerses.forEach(v => {
        const card = document.createElement('div');
        card.className = 'card-bg border rounded-2xl p-5 shadow-sm space-y-4 hover:border-amber-500/50 transition';

        card.innerHTML = `
            <div class="flex items-center justify-between border-b pb-2">
                <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    ${book.name} ${currentChapter}:${v.verse}
                </span>
                <button onclick="requestGrokExegesis('${book.name}', ${currentChapter}, ${v.verse}, '${v.id.replace(/'/g, "\\'")}')" class="text-xs text-amber-600 hover:underline flex items-center space-x-1">
                    <i class="fa-solid fa-robot"></i>
                    <span>Tafsiran & Eksegesis</span>
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm leading-relaxed">
                <div class="space-y-1">
                    <div class="text-[10px] uppercase tracking-wider text-amber-600 font-bold">Indonesia Modern</div>
                    <p class="font-serif-bible">${v.id}</p>
                </div>
                <div class="space-y-1 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4 border-gray-200 dark:border-gray-700">
                    <div class="text-[10px] uppercase tracking-wider text-blue-500 font-bold">English (BSB)</div>
                    <p class="font-serif-bible">${v.en}</p>
                </div>
                <div class="space-y-1 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4 border-gray-200 dark:border-gray-700">
                    <div class="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">${isOT ? 'Ibrani (Hebrew)' : 'Yunani (Greek)'}</div>
                    <p class="${isOT ? 'font-hebrew text-lg text-right' : 'font-greek text-base'} font-semibold">${v.orig}</p>
                    <p class="text-xs italic text-gray-500">${v.trans}</p>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Integrasi Grok API
async function requestGrokExegesis(book, chapter, verse, verseText) {
    const panel = document.getElementById('commentary-panel');
    const content = document.getElementById('commentary-content');
    panel.classList.remove('hidden');

    const apiKey = localStorage.getItem('grok_api_key');
    if (!apiKey) {
        content.innerHTML = `
            <div class="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
                <div class="font-bold text-amber-700 dark:text-amber-300">API Key Belum Dipasang</div>
                <p class="text-xs text-gray-600 dark:text-gray-300">Silakan atur Grok API Key Anda terlebih dahulu dengan mengklik ikon Kunci di navigasi atas.</p>
                <button onclick="promptApiKey()" class="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold">Masukkan Key</button>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="flex items-center space-x-2 text-amber-600 font-bold animate-pulse">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Menganalisis ${book} ${chapter}:${verse}...</span>
        </div>
    `;

    try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'grok-beta',
                messages: [
                    { role: 'system', content: 'Anda adalah seorang ahli eksegesis Alkitab dan bahasa Ibrani/Yunani. Berikan analisis eksegesis ringkas dan mendalam dalam Bahasa Indonesia.' },
                    { role: 'user', content: `Berikan analisis eksegesis untuk ${book} ${chapter}:${verse}. Teks: "${verseText}". Sertakan: 1. Terjemahan Indonesia Modern, 2. Analisis Kata Kunci Bahasa Asli, 3. Konteks Historis/Teologis, 4. Aplikasi Praktis Modern.` }
                ]
            })
        });

        const data = await response.json();
        if (data.choices && data.choices[0]) {
            content.innerHTML = `
                <div class="p-3 bg-amber-500/10 rounded-xl text-amber-700 dark:text-amber-300 font-bold text-sm mb-3">
                    Analisis Grok: ${book} ${chapter}:${verse}
                </div>
                <div class="text-xs space-y-2 leading-relaxed text-gray-700 dark:text-gray-200">
                    ${data.choices[0].message.content.replace(/\n/g, '<br>')}
                </div>
            `;
        } else {
            throw new Error("Respons API tidak valid");
        }
    } catch (err) {
        content.innerHTML = `<div class="p-3 bg-red-500/10 text-red-600 rounded-xl text-xs">Error Grok API: ${err.message}. Pastikan koneksi internet aktif.</div>`;
    }
}

function promptApiKey() {
    const key = prompt("Masukkan Grok API Key Anda (xai-...):", localStorage.getItem('grok_api_key') || '');
    if (key !== null) {
        localStorage.setItem('grok_api_key', key.trim());
        alert("API Key tersimpan secara lokal!");
    }
}

function toggleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    document.body.className = `theme-${themes[currentThemeIndex]} min-h-screen flex flex-col transition-colors duration-200`;
}

function closeCommentary() {
    document.getElementById('commentary-panel').classList.add('hidden');
}

document.addEventListener("DOMContentLoaded", initApp);
