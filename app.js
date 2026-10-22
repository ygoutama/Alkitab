// Model Grok: cek nama terbaru di docs.x.ai kalau error "model not found"
const GROK_MODEL = 'grok-4.7';

const themes = ['light', 'sepia', 'dark'];
let bibleData = null;
let currentBookId = "GEN";
let currentChapter = 1;
let currentTestament = "OT";
let currentThemeIndex = 0;
let currentVerses = [];
let labels = { id: 'Indonesia', en: 'English' };

const $ = id => document.getElementById(id);
const getBook = id => bibleData.books.find(b => b.id === id);
const dash = '<span class="text-gray-400">—</span>';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Inisialisasi ----------
async function initApp() {
    applyTheme(Math.max(0, themes.indexOf(localStorage.getItem('bible_theme'))));

    try {
        const response = await fetch('./data/bible_db.json');
        if (!response.ok) throw new Error("HTTP " + response.status);
        bibleData = await response.json();

        applyMeta();
        populateBookSelectors();
        renderSidebarBooks();
        renderPassage();
    } catch (err) {
        console.error("Error loading JSON:", err);
        const hint = location.protocol === 'file:'
            ? 'Halaman dibuka langsung dari file (file://), jadi browser memblokir fetch. Jalankan <b>python -m http.server 8000</b> di folder proyek, lalu buka <b>http://localhost:8000</b>.'
            : 'Pastikan <b>data/bible_db.json</b> ada dan isinya JSON valid (hasil <b>build_bible_json.py</b>).';
        $('verses-container').innerHTML = `
            <div class="p-6 bg-red-500/10 border border-red-500/30 text-red-600 rounded-2xl text-center space-y-2">
                <div class="font-bold">Gagal Memuat Database Alkitab</div>
                <p class="text-xs">${hint}</p>
            </div>`;
    }

    $('btn-toggle-sidebar').addEventListener('click', () => $('sidebar').classList.toggle('-translate-x-full'));

    // Satu listener untuk semua tombol eksegesis (aman dari karakter kutip di teks ayat)
    $('verses-container').addEventListener('click', e => {
        const btn = e.target.closest('[data-exegesis]');
        if (btn) requestGrokExegesis(currentVerses[+btn.dataset.exegesis]);
    });
}

function applyMeta() {
    const m = bibleData.meta || {};
    labels.id = m.idLabel || labels.id;
    labels.en = m.enLabel || labels.en;
    $('badge-label').innerText = `${labels.id} + ${labels.en} + Teks Asli`;
    $('sources').innerText = m.sources || '';
}

// ---------- Selector & Sidebar ----------
function populateBookSelectors() {
    const select = $('book-select');
    select.innerHTML = bibleData.books.map(b => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
    select.value = currentBookId;
    updateChapterSelector();
}

function updateChapterSelector() {
    const book = getBook(currentBookId);
    let html = '';
    for (let i = 1; i <= book.totalChapters; i++) html += `<option value="${i}">Pasal ${i}</option>`;
    $('chapter-select').innerHTML = html;
    $('chapter-select').value = currentChapter;
}

function switchTestament(testament) {
    currentTestament = testament;
    const on = 'flex-1 py-2.5 text-center border-b-2 border-amber-600 text-amber-600 font-bold';
    const off = 'flex-1 py-2.5 text-center border-b-2 border-transparent text-gray-500';
    $('tab-ot').className = testament === 'OT' ? on : off;
    $('tab-nt').className = testament === 'NT' ? on : off;
    renderSidebarBooks($('search-book').value);
}

// Tanpa query: tampilkan kitab sesuai tab. Dengan query: cari di semua kitab.
function renderSidebarBooks(query = '') {
    const q = query.trim().toLowerCase();
    const list = bibleData.books.filter(b => q ? b.name.toLowerCase().includes(q) : b.testament === currentTestament);
    const container = $('sidebar-book-list');
    container.innerHTML = '';
    list.forEach(b => {
        const btn = document.createElement('button');
        btn.className = `w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition flex justify-between items-center ${b.id === currentBookId ? 'bg-amber-500/10 text-amber-600 font-bold' : 'hover:bg-black/5 dark:hover:bg-white/5'}`;
        btn.innerHTML = `<span>${esc(b.name)}</span> <span class="text-xs text-gray-400 font-normal">${b.totalChapters} pas.</span>`;
        btn.onclick = () => selectBook(b.id);
        container.appendChild(btn);
    });
}

function selectBook(id) {
    currentBookId = id;
    currentChapter = 1;
    const book = getBook(id);
    $('book-select').value = id;
    updateChapterSelector();
    if (book.testament !== currentTestament) switchTestament(book.testament);
    else renderSidebarBooks($('search-book').value);
    renderPassage();
    if (window.innerWidth < 768) $('sidebar').classList.add('-translate-x-full');
}

function onBookChange() { selectBook($('book-select').value); }

function goToChapter(n) {
    currentChapter = n;
    $('chapter-select').value = n;
    renderPassage();
}

function onChapterChange() { goToChapter(parseInt($('chapter-select').value)); }

function prevChapter() {
    if (currentChapter > 1) goToChapter(currentChapter - 1);
}

function nextChapter() {
    if (currentChapter < getBook(currentBookId).totalChapters) goToChapter(currentChapter + 1);
}

// ---------- Render ayat ----------
function renderPassage() {
    const book = getBook(currentBookId);
    $('passage-title').innerText = `${book.name} ${currentChapter}`;
    $('main-scroll').scrollTo({ top: 0 });

    const container = $('verses-container');
    currentVerses = (bibleData.verses[currentBookId] || {})[currentChapter] || [];

    if (currentVerses.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-gray-400 space-y-2">
                <i class="fa-solid fa-file-circle-exclamation text-3xl mb-2"></i>
                <p>Teks untuk ${esc(book.name)} ${currentChapter} belum ada di file JSON database.</p>
            </div>`;
        return;
    }

    const isOT = book.testament === 'OT';

    container.innerHTML = currentVerses.map((v, i) => `
        <div class="card-bg border rounded-2xl p-5 shadow-sm space-y-4 hover:border-amber-500/50 transition">
            <div class="flex items-center justify-between border-b pb-2">
                <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    ${esc(book.name)} ${currentChapter}:${v.verse}
                </span>
                <button data-exegesis="${i}" class="text-xs text-amber-600 hover:underline flex items-center space-x-1">
                    <i class="fa-solid fa-robot"></i>
                    <span>Tafsiran & Eksegesis</span>
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm leading-relaxed">
                <div class="space-y-1">
                    <div class="text-[10px] uppercase tracking-wider text-amber-600 font-bold">${esc(labels.id)}</div>
                    <p class="font-serif-bible">${v.id ? esc(v.id) : dash}</p>
                </div>
                <div class="space-y-1 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4 border-gray-200 dark:border-gray-700">
                    <div class="text-[10px] uppercase tracking-wider text-blue-500 font-bold">${esc(labels.en)}</div>
                    <p class="font-serif-bible">${v.en ? esc(v.en) : dash}</p>
                </div>
                <div class="space-y-1 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4 border-gray-200 dark:border-gray-700">
                    <div class="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">${isOT ? 'Ibrani (Hebrew)' : 'Yunani (Greek)'}</div>
                    <p class="${isOT ? 'font-hebrew text-lg text-right' : 'font-greek text-base'} font-semibold">${v.orig ? esc(v.orig) : dash}</p>
                    <p class="text-xs italic text-gray-500">${esc(v.trans)}</p>
                </div>
            </div>
        </div>`).join('');
}

// ---------- Grok API (eksegesis) ----------
function openCommentary() {
    const p = $('commentary-panel');
    p.classList.remove('hidden');
    p.classList.add('flex');
}

function closeCommentary() {
    const p = $('commentary-panel');
    p.classList.add('hidden');
    p.classList.remove('flex');
}

async function requestGrokExegesis(v) {
    const ref = `${getBook(currentBookId).name} ${currentChapter}:${v.verse}`;
    const content = $('commentary-content');
    openCommentary();

    const apiKey = localStorage.getItem('grok_api_key');
    if (!apiKey) {
        content.innerHTML = `
            <div class="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
                <div class="font-bold text-amber-700 dark:text-amber-300">API Key Belum Dipasang</div>
                <p class="text-xs text-gray-600 dark:text-gray-300">Atur Grok API Key dulu dengan mengklik ikon Kunci di navigasi atas.</p>
                <button onclick="promptApiKey()" class="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold">Masukkan Key</button>
            </div>`;
        return;
    }

    content.innerHTML = `
        <div class="flex items-center space-x-2 text-amber-600 font-bold animate-pulse">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Menganalisis ${esc(ref)}...</span>
        </div>`;

    const prompt = `Berikan analisis eksegesis untuk ${ref}.
Teks Indonesia (${labels.id}): "${v.id}"
Teks Inggris (${labels.en}): "${v.en}"
Teks bahasa asli: "${v.orig}"
Sertakan: 1. Terjemahan Indonesia Modern, 2. Analisis Kata Kunci Bahasa Asli, 3. Konteks Historis/Teologis, 4. Aplikasi Praktis Modern.`;

    try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: GROK_MODEL,
                messages: [
                    { role: 'system', content: 'Anda adalah seorang ahli eksegesis Alkitab dan bahasa Ibrani/Yunani. Berikan analisis eksegesis ringkas dan mendalam dalam Bahasa Indonesia.' },
                    { role: 'user', content: prompt }
                ]
            })
        });

        const data = await response.json();
        if (!response.ok || !data.choices || !data.choices[0]) {
            const e = data.error;
            throw new Error((e && (e.message || e)) || `HTTP ${response.status}`);
        }

        const html = esc(data.choices[0].message.content)
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/\n/g, '<br>');
        content.innerHTML = `
            <div class="p-3 bg-amber-500/10 rounded-xl text-amber-700 dark:text-amber-300 font-bold text-sm mb-3">
                Analisis Grok: ${esc(ref)}
            </div>
            <div class="text-xs space-y-2 leading-relaxed text-gray-700 dark:text-gray-200">${html}</div>`;
    } catch (err) {
        content.innerHTML = `<div class="p-3 bg-red-500/10 text-red-600 rounded-xl text-xs">Error Grok API: ${esc(err.message)}</div>`;
    }
}

function promptApiKey() {
    const key = prompt("Masukkan Grok API Key Anda (xai-...):", localStorage.getItem('grok_api_key') || '');
    if (key !== null) {
        localStorage.setItem('grok_api_key', key.trim());
        alert("API Key tersimpan secara lokal di browser ini.");
    }
}

// ---------- Tema ----------
function applyTheme(i) {
    currentThemeIndex = i;
    document.body.className = `theme-${themes[i]} min-h-screen flex flex-col transition-colors duration-200`;
    document.documentElement.classList.toggle('dark', themes[i] === 'dark'); // supaya kelas dark: Tailwind ikut tema
    localStorage.setItem('bible_theme', themes[i]);
}

function toggleTheme() { applyTheme((currentThemeIndex + 1) % themes.length); }

document.addEventListener("DOMContentLoaded", initApp);
