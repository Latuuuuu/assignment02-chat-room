import { onValue, push, ref, set } from "firebase/database";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../config.js";
import '../styles/database.scss';

// ── Cache ─────────────────────────────────────────────────────────────────────
const CACHE_KEY = "firebase_db_snapshot";
function readCache() { try { const r = localStorage.getItem(CACHE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function writeCache(data) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {} }

// ── Tree builder ──────────────────────────────────────────────────────────────
function buildTree(data, path = "/") {
    if (data === null || data === undefined) return null;
    if (typeof data !== "object")
        return { path, label: path.split("/").filter(Boolean).pop() || "/", value: data, children: [] };
    const label = path.split("/").filter(Boolean).pop() || "root";
    return {
        path, label, value: null,
        children: Object.entries(data).map(([k, v]) =>
            buildTree(v, path === "/" ? `/${k}` : `${path}/${k}`)
        )
    };
}

// ── Layout ────────────────────────────────────────────────────────────────────
const NW = 130, NH = 44, HG = 30, VG = 56;

function layoutTree(node, depth = 0, counter = { val: 0 }) {
    if (!node) return null;
    const ch = node.children.map(c => layoutTree(c, depth + 1, counter));
    const x = depth * (NW + HG);
    const y = ch.length === 0 ? (counter.val++) * (NH + VG) : (ch[0].y + ch[ch.length - 1].y) / 2;
    return { ...node, x, y, children: ch };
}

function collectNodes(node, acc = []) {
    if (!node) return acc;
    acc.push(node);
    node.children.forEach(c => collectNodes(c, acc));
    return acc;
}

function collectEdges(node, acc = []) {
    if (!node) return acc;
    node.children.forEach(c => {
        acc.push({ x1: node.x + NW, y1: node.y + NH / 2, x2: c.x, y2: c.y + NH / 2 });
        collectEdges(c, acc);
    });
    return acc;
}

// ── Write Form ────────────────────────────────────────────────────────────────
// Self-contained form with Text/JSON mode + Set/Push operations.
function WriteForm({ initialPath = '', initialTextVal = '' }) {
    const [path, setPath] = useState(initialPath);
    const [mode, setMode] = useState('text');
    const [textVal, setTextVal] = useState(initialTextVal);
    const [rows, setRows] = useState([{ id: 1, key: '', value: '' }]);
    const [status, setStatus] = useState(null); // null|'set'|'push'|'err'|'nopath'
    const nextId = useRef(2);

    const addRow = () => setRows(r => [...r, { id: nextId.current++, key: '', value: '' }]);
    const removeRow = id => setRows(r => r.filter(row => row.id !== id));
    const updateRow = (id, field, val) =>
        setRows(r => r.map(row => row.id === id ? { ...row, [field]: val } : row));

    const buildData = () => {
        if (mode === 'text') return textVal;
        const obj = {};
        rows.forEach(({ key, value }) => { if (key.trim()) obj[key.trim()] = value; });
        return obj;
    };

    const flash = result => { setStatus(result); setTimeout(() => setStatus(null), 3000); };

    const doSet = async () => {
        if (!path.trim()) { flash('nopath'); return; }
        try { await set(ref(db, path.trim()), buildData()); flash('set'); }
        catch (e) { console.error(e); flash('err'); }
    };

    const doPush = async () => {
        if (!path.trim()) { flash('nopath'); return; }
        try { await push(ref(db, path.trim()), buildData()); flash('push'); }
        catch (e) { console.error(e); flash('err'); }
    };

    return (
        <div className="wf">
            {/* Path */}
            <div className="db__field">
                <label className="db__label">Reference Path</label>
                <input className="db__input" value={path} onChange={e => setPath(e.target.value)} placeholder="/users/alice" />
            </div>

            {/* Mode toggle */}
            <div className="wf__modes">
                <button className={`wf__mode-btn${mode === 'text' ? ' wf__mode-btn--active' : ''}`} onClick={() => setMode('text')}>Text</button>
                <button className={`wf__mode-btn${mode === 'json' ? ' wf__mode-btn--active' : ''}`} onClick={() => setMode('json')}>JSON</button>
            </div>

            {/* Input area */}
            {mode === 'text' ? (
                <input
                    className="db__input"
                    value={textVal}
                    onChange={e => setTextVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doSet()}
                    placeholder="value"
                />
            ) : (
                <div className="wf__table">
                    <div className="wf__thead">
                        <span>Property</span>
                        <span>Value</span>
                        <span />
                    </div>
                    {rows.map(row => (
                        <div key={row.id} className="wf__row">
                            <input
                                className="wf__cell"
                                value={row.key}
                                onChange={e => updateRow(row.id, 'key', e.target.value)}
                                placeholder="key"
                            />
                            <input
                                className="wf__cell"
                                value={row.value}
                                onChange={e => updateRow(row.id, 'value', e.target.value)}
                                placeholder="value"
                            />
                            <button className="wf__del" onClick={() => removeRow(row.id)}>✕</button>
                        </div>
                    ))}
                    <button className="wf__add-row" onClick={addRow}>+ Add Property</button>
                </div>
            )}

            {/* Actions */}
            <div className="wf__actions">
                <button className="wf__btn wf__btn--set" onClick={doSet} title="Overwrite data at this path">Set</button>
                <button className="wf__btn wf__btn--push" onClick={doPush} title="Append with an auto-generated key">Push</button>
            </div>

            {/* Status feedback */}
            {status === 'set'    && <div className="wf__status wf__status--ok">Set at <code>{path}</code></div>}
            {status === 'push'   && <div className="wf__status wf__status--ok">Pushed under <code>{path}</code></div>}
            {status === 'err'    && <div className="wf__status wf__status--err">Write failed — check path &amp; rules.</div>}
            {status === 'nopath' && <div className="wf__status wf__status--err">Enter a reference path first.</div>}
        </div>
    );
}

// ── SVG Tree ──────────────────────────────────────────────────────────────────
function TreeGraph({ tree, selectedPath, onSelect }) {
    const containerRef = useRef(null);
    const [pan, setPan] = useState({ x: 40, y: 40 });
    const [zoom, setZoom] = useState(1);
    const drag = useRef(null);

    const laid = layoutTree(tree);
    const nodes = collectNodes(laid);
    const edgeList = collectEdges(laid);
    const svgW = nodes.reduce((m, n) => Math.max(m, n.x + NW), 0) + 80;
    const svgH = nodes.reduce((m, n) => Math.max(m, n.y + NH), 0) + 80;

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onWheel = e => { e.preventDefault(); setZoom(z => Math.min(3, Math.max(0.3, z - e.deltaY * 0.001))); };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    });

    return (
        <div
            className="db__tree-canvas"
            ref={containerRef}
            onMouseDown={e => { if (e.button !== 0) return; drag.current = { sx: e.clientX - pan.x, sy: e.clientY - pan.y }; }}
            onMouseMove={e => { if (!drag.current) return; setPan({ x: e.clientX - drag.current.sx, y: e.clientY - drag.current.sy }); }}
            onMouseUp={() => { drag.current = null; }}
            onMouseLeave={() => { drag.current = null; }}
        >
            <div className="db__tree-hint">scroll to zoom · drag to pan</div>
            <svg width={svgW} height={svgH} style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", userSelect: "none", overflow: "visible" }}>
                {edgeList.map((e, i) => {
                    const mx = (e.x1 + e.x2) / 2;
                    return <path key={i} d={`M${e.x1},${e.y1} C${mx},${e.y1} ${mx},${e.y2} ${e.x2},${e.y2}`} fill="none" stroke="#30363d" strokeWidth={1.5} />;
                })}
                {nodes.map((n, i) => {
                    const sel = n.path === selectedPath, leaf = n.children.length === 0;
                    return (
                        <g key={i} style={{ cursor: "pointer" }} onClick={() => onSelect(n)}>
                            <rect x={n.x} y={n.y} width={NW} height={NH} rx={8}
                                fill={sel ? "#1f6feb" : leaf ? "#161b22" : "#21262d"}
                                stroke={sel ? "#58a6ff" : leaf ? "#30363d" : "#444c56"}
                                strokeWidth={sel ? 2 : 1}
                            />
                            <text x={n.x + NW / 2} y={n.y + NH / 2 - (n.value !== null ? 5 : 0)}
                                textAnchor="middle" fill={sel ? "#fff" : "#c9d1d9"}
                                fontSize={12} fontWeight={600} fontFamily="'Segoe UI',system-ui,sans-serif">
                                {n.label.length > 14 ? n.label.slice(0, 12) + "…" : n.label}
                            </text>
                            {n.value !== null && (
                                <text x={n.x + NW / 2} y={n.y + NH / 2 + 10}
                                    textAnchor="middle" fill={sel ? "#93c5fd" : "#8b949e"}
                                    fontSize={10} fontFamily="monospace">
                                    {String(n.value).length > 16 ? String(n.value).slice(0, 14) + "…" : String(n.value)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export const Database = () => {
    const [dbData, setDbData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        const cached = readCache();
        if (cached) { setDbData(cached); setLoading(false); }
        const unsub = onValue(ref(db, "/"), snap => {
            const val = snap.val();
            setDbData(val);
            writeCache(val);
            setUpdatedAt(new Date().toLocaleTimeString());
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const tree = dbData ? buildTree(dbData) : null;
    const handleSelect = useCallback(node => setSelected(node), []);

    return (
        <div className="db">
            <div className="db__header">
                <h1 className="db__title">Realtime Database</h1>
                <span className="db__meta">{updatedAt ? `synced ${updatedAt}` : loading ? "connecting…" : ""}</span>
                <div className={`db__status db__status--${loading ? "loading" : "live"}`} title={loading ? "Connecting…" : "Live"} />
            </div>

            <div className="db__body">
                {/* Tree */}
                <div className="db__tree-area">
                    <div className="db__tree-label">Database Structure</div>
                    {loading
                        ? <div className="db__empty">Connecting…</div>
                        : !tree
                            ? <div className="db__empty">No data yet.</div>
                            : <TreeGraph tree={tree} selectedPath={selected?.path} onSelect={handleSelect} />
                    }
                </div>

                {/* Sidebar */}
                <div className="db__side">

                    {/* Selected node panel */}
                    <div className={`db__panel${selected ? " db__panel--selected" : ""}`}>
                        <div className="db__panel-header">
                            <span className="db__panel-title">Selected Node</span>
                            {selected && <button className="db__close-btn" onClick={() => setSelected(null)}>✕</button>}
                        </div>
                        {!selected
                            ? <p className="db__placeholder">Click a node in the tree</p>
                            : (
                                <>
                                    {selected.value !== null && (
                                        <p className="db__current-val">Current: <code>{String(selected.value)}</code></p>
                                    )}
                                    {/* key resets form state when selection changes */}
                                    <WriteForm
                                        key={selected.path}
                                        initialPath={selected.path}
                                        initialTextVal={selected.value !== null ? String(selected.value) : ''}
                                    />
                                </>
                            )
                        }
                    </div>

                    {/* Manual write panel */}
                    <div className="db__panel">
                        <div className="db__panel-header">
                            <span className="db__panel-title">Write Data</span>
                        </div>
                        <WriteForm />
                    </div>

                </div>
            </div>
        </div>
    );
};
