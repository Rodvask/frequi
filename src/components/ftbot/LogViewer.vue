<script setup lang="ts">
const botStore = useBotStore();
const scrollContainer = ref<HTMLElement | null>(null);
const searchQuery = ref('');
const levelFilter = ref<string[]>([]);
const autoRefresh = ref(false);
const loading = ref(false);
const followBottom = ref(true);
const wrapLines = ref(true);
const themeOpen = ref(false);
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const;

const themes = {
  'Tokyo Night':           { bg:'#1a1b26', surface:'#151620', border:'#2a2b3e', text:'#c0caf5', muted:'#565f89', accent:'#7aa2f7', debug:'#6b7280', info:'#22d3ee', warning:'#fbbf24', error:'#ef4444' },
  Dracula:                 { bg:'#282a36', surface:'#21222c', border:'#44475a', text:'#f8f8f2', muted:'#6272a4', accent:'#bd93f9', debug:'#6272a4', info:'#8be9fd', warning:'#f1fa8c', error:'#ff5555' },
  'One Dark':              { bg:'#1e222a', surface:'#181b21', border:'#2c313a', text:'#abb2bf', muted:'#5c6370', accent:'#61afef', debug:'#5c6370', info:'#56b6c2', warning:'#e5c07b', error:'#e06c75' },
  Nord:                    { bg:'#2e3440', surface:'#252933', border:'#3b4252', text:'#d8dee9', muted:'#616e88', accent:'#88c0d0', debug:'#616e88', info:'#81a1c1', warning:'#ebcb8b', error:'#bf616a' },
  'Catppuccin Mocha':      { bg:'#1e1e2e', surface:'#181825', border:'#313244', text:'#cdd6f4', muted:'#6c7086', accent:'#89b4fa', debug:'#6c7086', info:'#89dceb', warning:'#f9e2af', error:'#f38ba8' },
  'Gruvbox Dark':          { bg:'#282828', surface:'#1d2021', border:'#3c3836', text:'#ebdbb2', muted:'#7c6f64', accent:'#fabd2f', debug:'#7c6f64', info:'#83a598', warning:'#fabd2f', error:'#fb4934' },
  'Solarized Dark':        { bg:'#002b36', surface:'#00212b', border:'#073642', text:'#839496', muted:'#586e75', accent:'#268bd2', debug:'#586e75', info:'#2aa198', warning:'#b58900', error:'#dc322f' },
  'Classic Green':         { bg:'#0d0d0d', surface:'#0a0a0a', border:'#1a1a1a', text:'#00ff41', muted:'#00aa22', accent:'#00cc33', debug:'#007711', info:'#00ff41', warning:'#55ff55', error:'#ff3333' },
  Amber:                   { bg:'#1a0e00', surface:'#150b00', border:'#2a1800', text:'#ffb000', muted:'#884400', accent:'#ff8800', debug:'#663300', info:'#ffb000', warning:'#ffcc44', error:'#ff3333' },
  Monokai:                 { bg:'#272822', surface:'#1e1f1c', border:'#3b3a32', text:'#f8f8f2', muted:'#75715e', accent:'#a6e22e', debug:'#75715e', info:'#66d9ef', warning:'#e6db74', error:'#f92672' },
};

const saved = localStorage.getItem('ft-terminal-theme');
const currentTheme = ref(saved && saved in themes ? saved : 'Tokyo Night');

const themeVars = computed(() => {
  const th = themes[currentTheme.value as keyof typeof themes];
  return {
    '--term-bg': th.bg,
    '--term-surface': th.surface,
    '--term-border': th.border,
    '--term-text': th.text,
    '--term-muted': th.muted,
    '--term-accent': th.accent,
    '--term-debug': th.debug,
    '--term-info': th.info,
    '--term-warning': th.warning,
    '--term-error': th.error,
  } as Record<string, string>;
});

interface LogEntry { date: string; level: string; module: string; msg: string; raw: string; }

const allLines = computed<LogEntry[]>(() => {
  const logs = botStore.activeBot.lastLogs ?? [];
  return logs.map((log: string[]) => ({
    date: log[0] || '',
    level: (log[3] || '').padEnd(7),
    module: log[2] || '',
    msg: log[4] || '',
    raw: `${log[0] || ''} ${log[3] || ''} ${log[2] || ''} ${log[4] || ''}`,
  }));
});

const filteredLines = computed(() => {
  let lines = allLines.value;
  if (levelFilter.value.length > 0) lines = lines.filter((l) => levelFilter.value.includes(l.level.trim()));
  if (searchQuery.value) { const q = searchQuery.value.toLowerCase(); lines = lines.filter((l) => l.raw.toLowerCase().includes(q)); }
  return lines;
});

const logCount = computed(() => allLines.value.length);
const filteredCount = computed(() => filteredLines.value.length);

function toggleLevel(level: string) {
  const idx = levelFilter.value.indexOf(level);
  if (idx >= 0) levelFilter.value.splice(idx, 1); else levelFilter.value.push(level);
}
function clearFilters() { levelFilter.value = []; searchQuery.value = ''; }

function copyAll() {
  if (!navigator.clipboard?.writeText || !filteredLines.value.length) return;
  navigator.clipboard.writeText(filteredLines.value.map((l) => `${l.date} ${l.level} ${l.module} - ${l.msg}`).join('\n')).catch(() => {});
}

function exportLogs() {
  if (!filteredLines.value.length) return;
  const text = filteredLines.value.map((l) => `${l.date} ${l.level} ${l.module} - ${l.msg}`).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `logs-${new Date().toISOString().slice(0, 10)}.log`; a.click();
  URL.revokeObjectURL(url);
}

function setTheme(name: string) {
  currentTheme.value = name;
  localStorage.setItem('ft-terminal-theme', name);
  themeOpen.value = false;
}

function onScroll() {
  if (!scrollContainer.value) return;
  const el = scrollContainer.value;
  followBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}

function scrollToBottom() {
  followBottom.value = true;
  nextTick(() => { if (scrollContainer.value) scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight; });
}

watch(() => botStore.activeBot.lastLogs?.length, () => { if (followBottom.value) nextTick(() => { if (scrollContainer.value) scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight; }); });

onMounted(async () => { await botStore.activeBot.getLogs(); });
onBeforeUnmount(() => { if (autoRefreshTimer) clearInterval(autoRefreshTimer); });

watch(autoRefresh, (val) => {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  if (val) autoRefreshTimer = setInterval(() => botStore.activeBot.getLogs(), 10000);
});

async function refreshLogs() {
  loading.value = true;
  await botStore.activeBot.getLogs();
  loading.value = false;
}
</script>

<template>
  <div class="flex flex-col h-full font-mono select-none" :style="{ ...themeVars, background: 'var(--term-bg)', borderRadius: '0.5rem', overflow: 'hidden' }">
    <!-- Terminal bar -->
    <div class="flex items-center gap-2 px-3 py-1.5 text-xs shrink-0" :style="{ background: 'var(--term-surface)', borderBottom: '1px solid var(--term-border)', color: 'var(--term-muted)' }">
      <span class="w-2.5 h-2.5 rounded-full" style="background:#ff5f57" />
      <span class="w-2.5 h-2.5 rounded-full" style="background:#febc2e" />
      <span class="w-2.5 h-2.5 rounded-full" style="background:#28c840" />
      <span class="ms-2 font-semibold" :style="{ color: 'var(--term-text)' }">Logs</span>
      <span class="ms-1">{{ logCount }} lines</span>
      <span v-if="filteredCount !== logCount" :style="{ color: 'var(--term-accent)' }">({{ filteredCount }} shown)</span>

      <div class="ms-auto flex items-center gap-1">
        <div class="relative">
          <button class="tool-btn" :style="{ color: 'var(--term-muted)' }" title="Theme" @click="themeOpen = !themeOpen">🎨</button>
          <div v-if="themeOpen" class="absolute top-full right-0 mt-1 z-50 py-1 rounded-md shadow-lg" :style="{ background: 'var(--term-surface)', border: '1px solid var(--term-border)' }">
            <button v-for="(th, name) in themes" :key="name"
              class="block w-full text-left px-3 py-1 text-xs whitespace-nowrap"
              :style="{
                color: name === currentTheme ? 'var(--term-accent)' : 'var(--term-text)',
                background: name === currentTheme ? 'color-mix(in srgb, var(--term-accent) 15%, transparent)' : 'transparent',
              }"
              @click="setTheme(name)"
            >
              <span class="inline-block w-2.5 h-2.5 rounded-full me-2 align-middle" :style="{ background: th.accent }" />
              {{ name }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2 px-3 py-1.5 text-xs shrink-0" :style="{ background: 'var(--term-bg)', borderBottom: '1px solid var(--term-border)' }">
      <div class="relative flex-1 min-w-[8rem] max-w-[14rem]">
        <input v-model="searchQuery" type="text" placeholder="Search…" class="w-full px-2 py-1 rounded text-xs font-mono outline-none"
          :style="{ background: 'var(--term-bg)', color: 'var(--term-text)', border: '1px solid var(--term-border)' }" />
        <button v-if="searchQuery" class="absolute right-1 top-1/2 -translate-y-1/2 leading-none" :style="{ color: 'var(--term-muted)' }" @click="searchQuery = ''">✕</button>
      </div>

      <div class="flex items-center gap-1 flex-wrap">
        <button v-for="level in LOG_LEVELS" :key="level" class="level-pill"
          :style="{
            color: `var(--term-${level.toLowerCase()})`,
            background: levelFilter.length === 0 || levelFilter.includes(level) ? `color-mix(in srgb, var(--term-${level.toLowerCase()}) 18%, transparent)` : 'transparent',
            borderColor: levelFilter.length === 0 || levelFilter.includes(level) ? `var(--term-${level.toLowerCase()})` : 'var(--term-border)',
            opacity: levelFilter.length === 0 || levelFilter.includes(level) ? 1 : 0.35,
          }"
          @click="toggleLevel(level)"
        >{{ level.slice(0, 4) }}</button>
        <button v-if="levelFilter.length > 0 || searchQuery" class="px-1 py-0.5 rounded text-xs"
          :style="{ color: 'var(--term-muted)', border: '1px solid var(--term-border)' }"
          @click="clearFilters()">Clear</button>
      </div>

      <div class="ms-auto flex items-center gap-1">
        <input id="chk-auto" v-model="autoRefresh" type="checkbox" :style="{ accentColor: 'var(--term-accent)' }" />
        <label for="chk-auto" :style="{ color: 'var(--term-muted)' }" class="cursor-pointer">Auto</label>
        <button class="tool-btn" :style="{ color: followBottom ? 'var(--term-accent)' : 'var(--term-muted)' }" title="Auto-scroll" @click="scrollToBottom">⤓</button>
        <button class="tool-btn" :style="{ color: 'var(--term-muted)' }" title="Word wrap" @click="wrapLines = !wrapLines">
          <span :style="{ textDecoration: wrapLines ? 'none' : 'line-through' }">¶</span>
        </button>
        <button class="tool-btn" :style="{ color: 'var(--term-muted)' }" title="Copy all" @click="copyAll">⎘</button>
        <button class="tool-btn" :style="{ color: 'var(--term-muted)' }" title="Export .log" @click="exportLogs">↓</button>
        <button class="tool-btn" :style="{ color: loading ? 'var(--term-muted)' : 'var(--term-accent)' }" :disabled="loading" title="Reload" @click="refreshLogs">↻</button>
      </div>
    </div>

    <!-- Terminal output -->
    <div ref="scrollContainer" class="flex-1 min-h-0 overflow-auto" :style="{ background: 'var(--term-bg)' }" @scroll="onScroll">
      <div v-if="levelFilter.length > 0 || searchQuery" class="flex items-center gap-2 px-3 py-1 text-[0.6rem]"
        :style="{ background: 'var(--term-surface)', color: 'var(--term-muted)' }">
        <span v-if="levelFilter.length > 0">Showing: {{ levelFilter.join(', ') }}</span>
        <span v-if="searchQuery" :style="{ color: 'var(--term-accent)' }">Matching: "{{ searchQuery }}"</span>
        <span v-if="!filteredLines.length">— no results</span>
      </div>

      <div v-if="!logCount && !loading" class="flex items-center justify-center h-full text-xs" :style="{ color: 'var(--term-muted)' }">No logs available.</div>

      <div class="px-3 py-1">
        <div v-for="(line, i) in filteredLines" :key="i" class="log-line"
          :style="{ whiteSpace: wrapLines ? 'pre-wrap' : 'pre', wordBreak: wrapLines ? 'break-word' : 'normal' }">
          <span class="log-date" :style="{ color: 'var(--term-muted)' }">{{ line.date }}</span>
          <span class="log-level" :style="{ color: `var(--term-${line.level.trim().toLowerCase()})` }">{{ line.level }}</span>
          <span class="log-module" :style="{ color: 'var(--term-muted)' }">[{{ line.module }}]</span>
          <span class="log-msg" :style="{ color: 'var(--term-text)' }">{{ line.msg }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.level-pill {
  padding: 0.12rem 0.55rem;
  border-radius: 999px;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  line-height: 1.5;
  backdrop-filter: blur(4px);
}
.level-pill:hover {
  transform: translateY(-1px);
  filter: brightness(1.2);
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.level-pill:active {
  transform: translateY(0) scale(0.96);
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6rem;
  height: 1.6rem;
  padding: 0 0.3rem;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  line-height: 1;
  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  background: transparent;
  border: 1px solid transparent;
}
.tool-btn:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.1);
  transform: translateY(-1px);
}
.tool-btn:active {
  transform: translateY(0) scale(0.93);
  background: rgba(255,255,255,0.12);
}
.tool-btn:disabled {
  cursor: default;
  opacity: 0.5;
}
.tool-btn:disabled:hover {
  transform: none;
  background: transparent;
  border-color: transparent;
}

.log-line {
  display: flex;
  gap: 0.6rem;
  padding: 1px 0;
  line-height: 1.6;
  font-size: 0.72rem;
  transition: background 0.15s ease;
}
.log-line:hover { background: rgba(255,255,255,0.03); border-radius: 3px; }
.log-date { flex-shrink: 0; font-size: 0.68rem; user-select: text; }
.log-level { flex-shrink: 0; font-weight: 700; font-size: 0.6rem; letter-spacing: 0.03em; min-width: 5.5ch; text-align: center; }
.log-module { flex-shrink: 0; max-width: 10rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.68rem; }
.log-msg { min-width: 0; }

@media (max-width: 640px) {
  .log-module { max-width: 5rem; }
  .log-line { gap: 0.35rem; font-size: 0.65rem; }
  .log-date { font-size: 0.6rem; }
}
</style>
