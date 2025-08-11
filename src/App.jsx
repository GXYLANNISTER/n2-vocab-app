import React, { useEffect, useMemo, useRef, useState } from "react";

// 纯 React 单文件，无外部依赖（不使用 shadcn/ui 或别名路径），可直接在画布预览
// 若要切回 UI 组件版，请确保装有 shadcn 组件并配置 @ 路径别名，同时使用 TSX 编译。

/********************** 基础小组件（Tailwind 风格） *************************/
const cx = (...args) => args.filter(Boolean).join(" ");

function Button({ children, onClick, variant = "default", disabled = false, className = "" }) {
  const styles = {
    default: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "border border-slate-300 hover:bg-slate-50",
    secondary: "bg-slate-100 hover:bg-slate-200",
    destructive: "bg-red-600 text-white hover:bg-red-500",
    ghost: "hover:bg-slate-100",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "px-3 py-2 rounded-xl text-sm transition disabled:opacity-50 disabled:cursor-not-allowed",
        styles,
        className
      )}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={cx("border rounded-2xl shadow-sm bg-white", className)}>{children}</div>;
}
function CardHeader({ children, className = "" }) {
  return <div className={cx("px-4 py-3 border-b bg-slate-50 rounded-t-2xl", className)}>{children}</div>;
}
function CardContent({ children, className = "" }) {
  return <div className={cx("px-4 py-4", className)}>{children}</div>;
}

function Input({ value, onChange, placeholder = "", className = "" }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={cx(
        "w-full px-3 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-slate-300",
        className
      )}
    />
  );
}

function Progress({ value }) {
  return (
    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
      <div className="h-full bg-slate-900" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/********************** 数据与工具 *************************/
// 示例词
const SAMPLE = [
  { word: "あいじょう", kanji: "愛情", partOfSpeech: "名", translation: "爱;爱情;热爱", example: "母の愛情(母爱)" },
  { word: "あいづち", kanji: "相槌", partOfSpeech: "名", translation: "随声附和;帮腔", example: "相槌を打つ(打帮腔)" },
  { word: "あかじ", kanji: "赤字", partOfSpeech: "名", translation: "赤字;亏空", example: "赤字を出す(出现赤字)" },
  { word: "いざかや", kanji: "居酒屋", partOfSpeech: "名", translation: "日式小酒馆" },
  { word: "いしき", kanji: "意識", partOfSpeech: "名", translation: "意识", example: "意識を失う(失去知觉)" },
];

const uid = (v) => `${v.kanji || v.word}|${v.word}`;
const today = () => new Date().toISOString().slice(0, 10);
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function speak(text, lang = "ja-JP") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// SRS 设置
const INTERVALS = [0, 1, 3, 7, 14];
const STORAGE_KEY = "n2_srs_v1";
function loadSrs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveSrs(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
function scheduleNext(now, level) {
  const d = new Date(now);
  d.setDate(d.getDate() + INTERVALS[Math.max(0, Math.min(level, INTERVALS.length - 1))]);
  return d.toISOString().slice(0, 10);
}

/********************** 页面 *************************/
export default function App() {
  const [data, setData] = useState(SAMPLE);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState("all");
  const [showKanji, setShowKanji] = useState(true);
  const [srs, setSrs] = useState({});
  const [tab, setTab] = useState("dict");

  useEffect(() => setSrs(loadSrs()), []);
  useEffect(() => saveSrs(srs), [srs]);

  const posList = useMemo(() => {
    const set = new Set();
    data.forEach((v) => v.partOfSpeech && set.add(v.partOfSpeech));
    return ["all", ...Array.from(set).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((v) => {
      if (pos !== "all" && (v.partOfSpeech || "") !== pos) return false;
      if (!q) return true;
      const hay = [v.word, v.kanji, v.translation, v.partOfSpeech, v.example, v.related]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, query, pos]);

  const dueToday = useMemo(() => {
    const t = today();
    return data.filter((v) => {
      const st = srs[uid(v)];
      if (!st) return true;
      return st.due <= t;
    });
  }, [data, srs]);

  // 导入 JSON 文件
  const fileRef = useRef(null);
  const onPickFile = () => fileRef.current && fileRef.current.click();
  const onLoadFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error("JSON 须为数组");
      const norm = arr
        .map((it) => ({
          word: String(it.word || it.kana || it.reading || "").trim(),
          kanji: it.kanji ? String(it.kanji).trim() : (it.kanji_word ? String(it.kanji_word).trim() : undefined),
          partOfSpeech: (String(it.partOfSpeech || it.pos || it["part_of_speech"] || "").trim() || undefined),
          translation: String(
            it.translation || it.cn || it.zh || it.definition || it.meaning || it["中文"] || it["释义"]
          ).trim(),
          example: it.example ? String(it.example).trim() : (it["例句"] ? String(it["例句"]).trim() : undefined),
          related: it.related ? String(it.related).trim() : undefined,
        }))
        .filter((v) => v.word && v.translation);
      if (!norm.length) throw new Error("未解析到有效词条");
      setData(norm);
      // 初始化 SRS
      setSrs((prev) => {
        const next = { ...prev };
        const t = today();
        norm.forEach((v) => {
          const id = uid(v);
          if (!next[id]) next[id] = { level: 0, due: t, history: [] };
        });
        return next;
      });
      alert(`已加载 ${norm.length} 条词汇`);
    } catch (err) {
      alert("解析失败：" + (err && err.message ? err.message : String(err)));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const exportProgress = () => {
    const blob = new Blob([JSON.stringify(srs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `n2_progress_${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProgress = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      setSrs(obj);
      alert("进度已导入");
    } catch (err) {
      alert("导入失败：" + (err && err.message ? err.message : String(err)));
    } finally {
      e.currentTarget.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="font-semibold">N2 词库学习</div>
          <div className="ml-auto flex items-center gap-2">
            <Input
              placeholder="搜索：假名 / 汉字 / 中文释义 / 例句"
              className="w-[280px]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select className="px-3 py-2 rounded-xl border" value={pos} onChange={(e) => setPos(e.target.value)}>
              {posList.map((p) => (
                <option key={p} value={p}>{p === "all" ? "全部词性" : p}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 pl-2 text-sm">
              <input type="checkbox" checked={showKanji} onChange={(e) => setShowKanji(e.target.checked)} /> 显示汉字
            </label>
            <Button variant="secondary" onClick={onPickFile}>加载词库</Button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onLoadFile} />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-2">
          <div className="inline-flex gap-2 rounded-xl bg-slate-100 p-1">
            {[
              { id: "dict", label: "词库" },
              { id: "practice", label: "练习" },
              { id: "progress", label: "进度" },
            ].map((t) => (
              <Button key={t.id} variant={tab === t.id ? "default" : "ghost"} onClick={() => setTab(t.id)}>
                {t.label}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {tab === "dict" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((v) => (
              <WordCard key={uid(v)} v={v} showKanji={showKanji} state={srs[uid(v)]} onSpeak={() => speak(v.word)} />
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-slate-500 py-10">未找到匹配项，试试更短的关键词或切换词性。</p>
            )}
          </div>
        )}

        {tab === "practice" && (
          <Practice pool={dueToday} all={data} srs={srs} onUpdateSrs={setSrs} showKanji={showKanji} />
        )}

        {tab === "progress" && (
          <ProgressPanel data={data} srs={srs} onReset={() => setSrs({})} onExport={exportProgress} onImport={importProgress} />
        )}
      </main>

      <footer className="py-8 text-center text-sm text-slate-500">
        可预览原型：支持导入 N2_1500.json、离线学习与本地 SRS。可直接部署至静态站点（Vercel/GitHub Pages）。
      </footer>
    </div>
  );
}

function WordCard({ v, showKanji, state, onSpeak }) {
  const title = showKanji && v.kanji ? `${v.kanji}（${v.word}）` : v.word;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="text-base font-semibold">{title}</div>
          <div className="flex items-center gap-2">
            {v.partOfSpeech && <span className="text-xs px-2 py-1 rounded-full border">{v.partOfSpeech}</span>}
            <Button variant="ghost" onClick={onSpeak} title="发音">朗读</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm"><span className="text-slate-500">释义：</span>{v.translation}</p>
        {v.example && <p className="text-xs text-slate-600 whitespace-pre-wrap"><span className="text-slate-500">例句：</span>{v.example}</p>}
        {v.related && <p className="text-xs text-slate-500">相关：{v.related}</p>}
        {state && (
          <div className="pt-2 flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-slate-100">熟练度 L{state.level}</span>
            <span className="px-2 py-1 rounded-full border">下次：{state.due}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Practice({ pool, all, srs, onUpdateSrs, showKanji }) {
  const [mode, setMode] = useState("flash");
  const [count, setCount] = useState(20);
  const [session, setSession] = useState([]);

  useEffect(() => {
    const base = pool.length ? pool : all;
    const chosen = shuffle(base).slice(0, count);
    setSession(chosen);
  }, [pool, all, count]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">模式</span>
            <select className="px-3 py-2 rounded-xl border" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="flash">记忆卡片 (SRS)</option>
              <option value="mc">中文义 多选</option>
              <option value="typing">中文义 手打</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">题量</span>
            <select className="px-3 py-2 rounded-xl border" value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto text-sm text-slate-500">到期可练：{pool.length} / 全部：{all.length}</div>
        </CardContent>
      </Card>

      {mode === "flash" && <Flashcards items={session} srs={srs} onUpdateSrs={onUpdateSrs} showKanji={showKanji} />}
      {mode === "mc" && <MultipleChoice items={session} />}
      {mode === "typing" && <Typing items={session} />}
      <div className="text-xs text-slate-500">提示：多选题的选项已锁定，不会在同一题目中改变顺序。</div>
    </div>
  );
}

function Flashcards({ items, srs, onUpdateSrs, showKanji }) {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const cur = items[idx];
  const total = items.length;

  useEffect(() => setRevealed(false), [idx]);
  if (!cur) return <p className="text-center text-slate-500">暂无题目</p>;

  const id = uid(cur);
  const title = showKanji && cur.kanji ? `${cur.kanji}（${cur.word}）` : cur.word;

  const mark = (pass) => {
    const now = new Date();
    const prev = srs[id] || { level: 0, due: today(), history: [] };
    const level = pass ? Math.min(4, prev.level + 1) : 0;
    const due = scheduleNext(now, level);
    const next = {
      ...srs,
      [id]: { level, due, history: [...(prev.history || []), { date: today(), result: pass ? "pass" : "fail" }] },
    };
    onUpdateSrs(next);
    setIdx((i) => Math.min(total - 1, i + 1));
  };

  const progress = Math.round((idx / Math.max(1, total)) * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="font-medium">记忆卡片 {idx + 1}/{total}</div>
          <div className="w-40"><Progress value={progress} /></div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-center mb-4">{title}</div>
        <div className="flex justify-center gap-3 mb-6">
          <Button variant="secondary" onClick={() => speak(cur.word)}>朗读</Button>
          <Button variant="outline" onClick={() => setRevealed(true)}>显示释义</Button>
        </div>
        {revealed && (
          <div className="max-w-2xl mx-auto bg-slate-50 rounded-2xl p-4 text-center space-y-2">
            <div className="text-lg">{cur.translation}</div>
            {cur.example && <div className="text-sm text-slate-600 whitespace-pre-wrap">{cur.example}</div>}
          </div>
        )}
        <div className="flex justify-center gap-3 mt-6">
          <Button variant="destructive" onClick={() => mark(false)}>不认识</Button>
          <Button onClick={() => mark(true)}>认识</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// 多选题：每题的选项初始化后固定，不随渲染改变
function MultipleChoice({ items }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [options, setOptions] = useState([]);
  const [correctIdx, setCorrectIdx] = useState(-1);

  const cur = items[idx];

  useEffect(() => {
    setPicked(null);
    if (!cur) {
      setOptions([]);
      setCorrectIdx(-1);
      return;
    }
    const others = shuffle(items.filter((_, i) => i !== idx)).slice(0, 3);
    const opts = shuffle([cur, ...others]);
    setOptions(opts);
    setCorrectIdx(opts.findIndex((v) => v === cur));
  }, [idx, items]);

  if (!cur) return <p className="text-center text-slate-500">暂无题目</p>;
  const isAnswered = picked !== null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="font-medium">多选题 {idx + 1}/{items.length}</div>
          <Button variant="ghost" onClick={() => setIdx((i) => Math.max(0, i - 1))}>重做上一题</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="text-2xl text-center font-bold">{cur.kanji ? `${cur.kanji}（${cur.word}）` : cur.word}</div>
        <div className="grid sm:grid-cols-2 gap-3">
          {options.map((opt, i) => (
            <Button
              key={i}
              variant={isAnswered ? (i === correctIdx ? "default" : i === picked ? "destructive" : "outline") : "outline"}
              className="justify-start h-auto py-3 text-left"
              onClick={() => setPicked(i)}
              disabled={isAnswered}
            >
              {opt.translation}
            </Button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))}>下一题</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Typing({ items }) {
  const [idx, setIdx] = useState(0);
  const [ans, setAns] = useState("");
  const [status, setStatus] = useState("idle"); // idle | right | wrong
  const cur = items[idx];

  if (!cur) return <p className="text-center text-slate-500">暂无题目</p>;

  const submit = () => {
    const norm = (s) => s.replace(/\s+/g, "").toLowerCase();
    const ok = norm(ans) === norm(cur.translation);
    setStatus(ok ? "right" : "wrong");
  };

  const next = () => {
    setIdx((i) => Math.min(items.length - 1, i + 1));
    setAns("");
    setStatus("idle");
  };

  return (
    <Card>
      <CardHeader><div className="font-medium">手打题 {idx + 1}/{items.length}</div></CardHeader>
      <CardContent className="space-y-4">
        <div className="text-2xl text-center font-bold">{cur.kanji ? `${cur.kanji}（${cur.word}）` : cur.word}</div>
        <div className="flex items-center gap-2 max-w-xl mx-auto">
          <Input placeholder="输入中文释义" value={ans} onChange={(e) => setAns(e.target.value)} />
          <Button onClick={submit}>提交</Button>
        </div>
        {status !== "idle" && (
          <div className={status === "right" ? "text-center text-green-600" : "text-center text-red-600"}>
            {status === "right" ? "✅ 正确！" : `❌ 正确答案：${cur.translation}`}
          </div>
        )}
        <div className="flex justify-end"><Button variant="secondary" onClick={next}>下一题</Button></div>
      </CardContent>
    </Card>
  );
}

function ProgressPanel({ data, srs, onReset, onExport, onImport }) {
  const stats = useMemo(() => {
    const res = { total: data.length, levels: [0, 0, 0, 0, 0], due: 0 };
    const t = today();
    data.forEach((v) => {
      const st = srs[uid(v)];
      if (!st) res.levels[0]++;
      else res.levels[Math.max(0, Math.min(4, st.level))]++;
      if (!st || st.due <= t) res.due++;
    });
    const learned = res.levels[1] + res.levels[2] + res.levels[3] + res.levels[4];
    res.learned = learned;
    res.rate = res.total ? Math.round((learned / res.total) * 100) : 0;
    return res;
  }, [data, srs]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <div className="font-semibold">总体进度</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>已掌握（L≥1）</div>
            <div className="font-semibold">{stats.learned}/{stats.total}</div>
          </div>
          <Progress value={stats.rate} />
          <div className="grid grid-cols-5 gap-2 text-center mt-2">
            {stats.levels.map((n, i) => (
              <div key={i} className="rounded-xl border p-2">
                <div className="text-xs text-slate-500">L{i}</div>
                <div className="font-semibold">{n}</div>
              </div>
            ))}
          </div>
          <div className="text-sm text-slate-500">今日到期：{stats.due}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold">数据与备份</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={onExport}>导出进度</Button>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="file" accept=".json" className="hidden" onChange={onImport} />
              <span className="px-4 py-2 rounded-xl border bg-slate-100 cursor-pointer">导入进度</span>
            </label>
            <Button variant="outline" onClick={onReset}>清空本地进度</Button>
          </div>
          <p className="text-sm text-slate-500">* 进度与复习计划保存在浏览器 LocalStorage，仅本机有效。</p>
        </CardContent>
      </Card>
    </div>
  );
}
