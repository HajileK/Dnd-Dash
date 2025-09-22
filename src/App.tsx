import React, { useEffect, useMemo, useRef, useState } from "react";

type NPC = {
    id: string;
    name: string;
    description: string;
    mod: number;
    initiative: number | null;
    createdAt: number;
    hp: number;
    maxHp?: number;
    tempHp?: number;
};

const STORAGE_KEY = "initiative-tracker-npcs-v1";

function d20(): number {
    return Math.floor(Math.random() * 20) + 1;
}

export default function App() {
    // file picker ref
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    function handleExport() {
        // versioned payload for future-proofing (optional)
        const payload = {
            version: 1 as const,
            exportedAt: Date.now(),
            npcs,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "characters.json"; // filename
        a.click();
        URL.revokeObjectURL(url);
    }

    async function handleImport(ev: React.ChangeEvent<HTMLInputElement>) {
        const file = ev.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const parsed = JSON.parse(text);

            // accept either raw array or { version, npcs }
            const incoming: unknown = Array.isArray(parsed) ? parsed : parsed?.npcs;
            if (!Array.isArray(incoming)) {
                throw new Error("Invalid JSON format");
            }

            // sanitize + cap to 200 (matches your current limit)
            const cleaned = incoming.slice(0, 200).map((n: any) => ({
                id: n?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: String(n?.name ?? "Unnamed"),
                description: String(n?.description ?? ""),
                mod: Number(n?.mod ?? 0) || 0,
                initiative: n?.initiative == null ? null : Number(n?.initiative) || 0,
                createdAt: Number(n?.createdAt ?? Date.now()),
                hp: Number(n?.hp ?? 0),
                maxHp: Number(n?.maxHp ?? 0),
                tempHp: Number(n?.tempHp ?? 0),
            })) as NPC[];

            setNpcs(cleaned);
            setTurnIndex(0);
        } catch (e: any) {
            alert(`Could not import: ${e?.message || "Invalid JSON"}`);
        } finally {
            // allow selecting the same file again later
            ev.target.value = "";
        }
    }

    const [npcs, setNpcs] = useState<NPC[]>(() => {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            return raw ? (JSON.parse(raw) as NPC[]) : [];
        } catch {
            return [];
        }
    });
    const [turnIndex, setTurnIndex] = useState<number>(0);
    const [form, setForm] = useState<{
        name: string;
        description: string;
        mod: string;
        hp: string;
        maxHp: string;
        tempHp: string;
    }>({
        name: "",
        description: "",
        mod: "",
        hp: "",
        maxHp: "",
        tempHp: "",
    });
    const [search, setSearch] = useState<string>("");
    const [listView, setListView] = useState<boolean>(false);

    const inputNameRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(npcs));
    }, [npcs]);

    const currentRowRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (listView) {
            currentRowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
        }
    }, [turnIndex, listView]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return npcs;
        return npcs.filter(
            (n) =>
                n.name.toLowerCase().includes(q) ||
                (n.description || "").toLowerCase().includes(q)
        );
    }, [npcs, search]);

    const sorted = visible;
    const currentId = npcs[turnIndex]?.id;

    function addNPC(e: React.FormEvent) {
        e.preventDefault();
        if (npcs.length >= 200) {
            alert("Limit reached: 200 NPCs");
            return;
        }
        const name = form.name.trim();
        if (!name) {
            inputNameRef.current?.focus();
            return;
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const modNum = Number(form.mod || 0) || 0;
        const npc: NPC = {
            id,
            name,
            description: form.description.trim(),
            mod: modNum,
            initiative: null,
            createdAt: Date.now(),
            hp: Number(form.hp || 10),
            maxHp: Number(form.maxHp || 10),
            tempHp: Number(form.tempHp || 0),
        };
        setNpcs((prev) => [...prev, npc]);
        setJustAddedId(id);
        setTimeout(() => setJustAddedId(null), 300);
        setForm({ name: "", description: "", mod: "", hp: "", maxHp: "", tempHp: "" });
    }

    function duplicateNPC(id: string) {
        setNpcs((prev) => {
            const target = prev.find((n) => n.id === id);
            if (!target) return prev;
            const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const clone: NPC = {
                ...target,
                id: newId,
                createdAt: Date.now(),
                name: `${target.name} (copy)`,
            };
            return [...prev, clone];
        });
    }

    function setNPC(
        id: string,
        updater: (n: NPC) => Partial<NPC>
    ) {
        setNpcs((prev) => prev.map((n) => (n.id === id ? { ...n, ...updater(n) } : n)));
    }

    function removeNPC(id: string) {
        setNpcs((prev) => {
            const idx = prev.findIndex((n) => n.id === id);
            const next = prev.filter((n) => n.id !== id);
            if (next.length === 0) {
                setTurnIndex(0);
            } else if (idx >= 0) {
                const newTurn = Math.min(turnIndex, next.length - 1);
                setTurnIndex(newTurn);
            }
            return next;
        });
    }

    function rollFor(id: string) {
        setNPC(id, (n) => ({ initiative: d20() + (Number(n.mod) || 0) }));
        setNPC(id, (n) => ({ initiative: d20() + (Number(n.mod) || 0) }));
        setBumpId(id);
        setTimeout(() => setBumpId(null), 250);
        askSort();
    }

    function rollAll() {
        withFade(() => {
            setNpcs((prev) =>
                prev.map((n) => ({ ...n, initiative: d20() + (Number(n.mod) || 0) }))
            );
            setTurnIndex(0);
            askSort();
        });
    }

    function clearAllInitiatives() {
        setNpcs((prev) => prev.map((n) => ({ ...n, initiative: null })));
        setTurnIndex(0);
    }

    function askSort() {
        if (window.confirm("Rolls complete. Sort by initiative now?")) {
            withFade(sortByInitiative);
        }
    }


    function sortByInitiative() {
        setNpcs((prev) =>
            [...prev].sort((a, b) => {
                const ai = a.initiative ?? -Infinity;
                const bi = b.initiative ?? -Infinity;
                if (bi !== ai) return bi - ai;
                const am = Number(a.mod) || 0;
                const bm = Number(b.mod) || 0;
                if (bm !== am) return bm - am;
                return a.name.localeCompare(b.name);
            })
        );
        setTurnIndex(0);
    }

    function nextTurn() {
        if (npcs.length === 0) return;
        setTurnIndex((i) => (i + 1) % npcs.length);
    }

    function prevTurn() {
        if (npcs.length === 0) return;
        setTurnIndex((i) => (i - 1 + npcs.length) % npcs.length);
    }

    function resetAll() {
        if (!window.confirm("Clear all NPCs?")) return;
        setNpcs([]);
        sessionStorage.removeItem(STORAGE_KEY);
        setTurnIndex(0);
        setForm({ name: "", description: "", mod: "", hp: "", maxHp: "", tempHp: "" });
    }


    //the animations n shit
    const [justAddedId, setJustAddedId] = useState<string | null>(null);
    const [bumpId, setBumpId] = useState<string | null>(null);
    const [turnPulse, setTurnPulse] = useState(false);

// pulse the current turn row/card when turn changes
    useEffect(() => {
        setTurnPulse(true);
        const t = setTimeout(() => setTurnPulse(false), 400);
        return () => clearTimeout(t);
    }, [turnIndex]);

    const [isFading, setIsFading] = useState(false);

    function withFade(update: () => void | Promise<void>, ms = 180) {
        setIsFading(true);
        setTimeout(async () => {
            await update();
            // let the DOM paint the new state before fading back in
            requestAnimationFrame(() => setIsFading(false));
        }, ms);
    }


    return (
        <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", padding: 24 }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                {/* Floating vertical toolbar */}
                <div className="floating-toolbar">
                    <button onClick={rollAll} title="Roll All">🎲</button>
                    <button onClick={() => withFade(sortByInitiative)} title="Sort">↕️</button>
                    <button onClick={clearAllInitiatives} title="Reset Initiatives">🔄</button>
                    <button onClick={prevTurn} title="Previous Turn">⬆️</button>
                    <button onClick={nextTurn} title="Next Turn">⬇️</button>
                    <button onClick={resetAll} title="Clear All">🗑️</button>
                    <button onClick={() => setListView(v => !v)} title="Toggle View">
                        {listView ? "📇" : "📋"}
                    </button>

                    {/* Export / Import */}
                    <button onClick={handleExport} title="Export JSON">💾</button>
                    <button onClick={() => fileInputRef.current?.click()} title="Import JSON">📂</button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json"
                        style={{ display: "none" }}
                        onChange={handleImport}
                    />
                </div>


                {/* Add NPC */}
                <form
                    onSubmit={addNPC}
                    style={{
                        marginBottom: 16,
                        background: "white",
                        borderRadius: 12,
                        padding: 12,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    }}
                >
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "2fr repeat(4, 60px) 3fr auto",
                            gap: 6,
                            alignItems: "center",
                        }}
                    >
                        <input
                            ref={inputNameRef}
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="Name"
                            required
                            style={{ padding: "4px 6px" }}
                        />
                        <input
                            type="number"
                            value={form.mod}
                            onChange={(e) => setForm((f) => ({ ...f, mod: e.target.value }))}
                            placeholder="Init"
                            style={{ width: "100%", padding: "4px 6px" }}
                        />
                        <input
                            type="number"
                            value={form.hp}
                            onChange={(e) => setForm((f) => ({ ...f, hp: e.target.value }))}
                            placeholder="HP"
                            style={{ width: "100%", padding: "4px 6px" }}
                        />
                        <input
                            type="number"
                            value={form.maxHp}
                            onChange={(e) => setForm((f) => ({ ...f, maxHp: e.target.value }))}
                            placeholder="Max"
                            style={{ width: "100%", padding: "4px 6px" }}
                        />
                        <input
                            type="number"
                            value={form.tempHp}
                            onChange={(e) => setForm((f) => ({ ...f, tempHp: e.target.value }))}
                            placeholder="Temp"
                            style={{ width: "100%", padding: "4px 6px", color: "#3b82f6" }}
                        />
                        <input
                            value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                            placeholder="Notes (AC, traits, etc.)"
                            style={{ padding: "4px 6px" }}
                        />
                        <button type="submit" style={{ padding: "4px 10px" }}>
                            Add
                        </button>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                        {npcs.length}/200
                    </div>
                </form>


                {/* Search */}
                <div style={{ background: "white", borderRadius: 12, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 16 }}>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name or description..."
                        style={{ width: "100%" }}
                    />
                </div>

                <div className={`fade-container ${isFading ? "fading" : ""}`}>
                {/* Views */}
                {listView ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr", // single column
                            gap: 4,                     // tight spacing
                        }}
                    >
                        {sorted.map((n) => {
                            const isTurn = n.id === currentId;
                            return (
                                <div
                                    key={n.id}
                                    ref={isTurn ? (el) => { currentRowRef.current = el; } : undefined}
                                    className={`${justAddedId === n.id ? "animate-pop" : ""} ${bumpId === n.id ? "animate-bump" : ""} ${isTurn && turnPulse ? "pulse-turn" : ""}`}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "2px 6px",
                                        fontSize: 13,
                                        borderBottom: "1px solid #e2e8f0",
                                        background: isTurn ? "#eef2ff" : "transparent",
                                        outline: isTurn ? "1px solid #6366f1" : "none",
                                        borderRadius: 6,
                                    }}
                                    title={n.description || ""}
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontWeight: isTurn ? 700 : 500,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap"
                                            }}
                                        >
                                            {n.name}
                                        </div>
                                        <div style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {n.description || "no description"}
                                        </div>
                                        <label style={{ color: "#64748b" }}>INIT:</label>
                                        <input
                                            type="number"
                                            value={n.initiative ?? ""}
                                            onChange={(e) => {
                                                setNPC(n.id, () => ({
                                                    initiative: e.target.value === "" ? null : Number(e.target.value) || 0,
                                                }));
                                            setBumpId(n.id);
                                            setTimeout(() => setBumpId(null), 250);
                                            }}
                                            placeholder=""
                                            style={{ width: 56, textAlign: "right" }}
                                        />
                                        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                                            <label style={{ fontSize: 11, color: "#64748b" }}>HP</label>
                                            <input
                                                type="number"
                                                value={n.hp}
                                                onChange={(e) => setNPC(n.id, () => ({ hp: Number(e.target.value) || 0 }))}
                                                style={{ width: 50, textAlign: "right" }}
                                            />
                                            <span style={{ fontSize: 12, color: "#64748b" }}>/</span>
                                            <input
                                                type="number"
                                                value={n.maxHp ?? ""}
                                                onChange={(e) => setNPC(n.id, () => ({ maxHp: Number(e.target.value) || 0 }))}
                                                placeholder="max"
                                                style={{ width: 50, textAlign: "right" }}
                                            />
                                            <input
                                                type="number"
                                                value={n.tempHp ?? 0}
                                                onChange={(e) => setNPC(n.id, () => ({ tempHp: Number(e.target.value) || 0 }))}
                                                placeholder="temp"
                                                style={{ width: 50, textAlign: "right", color: "#3b82f6" }}
                                            />
                                        </div>

                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ color: "#64748b", fontSize: 12 }}>Mod: {n.mod >= 0 ? `+${n.mod}` : n.mod}</span>
                                        <span style={{ color: "#64748b" }}>Init: {n.initiative ?? "—"}</span>
                                        <button onClick={() => rollFor(n.id)} title="Roll">Roll</button>
                                        <button onClick={() => duplicateNPC(n.id)} title="Duplicate">⧉</button>
                                        <button onClick={() => removeNPC(n.id)} title="Delete">✕</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // card view
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                        {sorted.map((n, idx) => {
                            const isTurn = n.id === currentId;
                            return (
                                <div
                                    key={n.id}
                                    className={`${justAddedId === n.id ? "animate-pop" : ""} ${bumpId === n.id ? "animate-bump" : ""} ${isTurn && turnPulse ? "pulse-turn" : ""}`}
                                    style={{
                                        background: "white",
                                        borderRadius: 16,
                                        padding: 16,
                                        border: `1px solid ${isTurn ? "#6366f1" : "transparent"}`,
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <input
                                                    value={n.name}
                                                    onChange={(e) => setNPC(n.id, () => ({ name: e.target.value }))}
                                                    style={{ fontWeight: 700, fontSize: 16, width: "100%" }}
                                                />
                                                {isTurn && (
                                                    <span style={{ fontSize: 12, padding: "2px 6px", borderRadius: 999, background: "#e0e7ff", color: "#4338ca" }}>
                                                Current Turn
                                              </span>
                                                )}
                                            </div>
                                            <input
                                                value={n.description}
                                                onChange={(e) => setNPC(n.id, () => ({ description: e.target.value }))}
                                                placeholder="notes..."
                                                style={{ marginTop: 6, width: "100%", fontSize: 13, color: "#475569" }}
                                            />
                                        </div>
                                        <button onClick={() => removeNPC(n.id)} title="Delete" style={{ background: "#fff1f2", color: "#e11d48", border: "1px solid #fecdd3", borderRadius: 10, padding: "2px 6px" }}>
                                            ✕
                                        </button>
                                        <button onClick={() => duplicateNPC(n.id)} title="Duplicate"
                                                style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 10, padding: "2px 6px" }}>
                                            ⧉
                                        </button>

                                    </div>

                                    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
                                        <div>
                                            <div style={{ fontSize: 11, color: "#64748b" }}>Initiative Modifier (Dex)</div>
                                            <input
                                                type="number"
                                                value={n.mod}
                                                onChange={(e) => setNPC(n.id, () => ({ mod: Number(e.target.value) || 0 }))}
                                            />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 11, color: "#64748b" }}>Initiative</div>
                                            <input
                                                type="number"
                                                value={n.initiative ?? ""}
                                                onChange={(e) => {
                                                    setNPC(n.id, () => ({
                                                        initiative: e.target.value === "" ? null : Number(e.target.value) || 0,
                                                    }));
                                                }}
                                                placeholder="—"
                                                style={{ width: 56, textAlign: "right" }}
                                            />
                                        </div>
                                        <div style={{ gridColumn: "1 / span 3", display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                                            <label style={{ fontSize: 11, color: "#64748b" }}>HP</label>
                                            <input
                                                type="number"
                                                value={n.hp}
                                                onChange={(e) => setNPC(n.id, () => ({ hp: Number(e.target.value) || 0 }))}
                                                style={{ width: 50, textAlign: "right" }}
                                            />
                                            <span style={{ fontSize: 12, color: "#64748b" }}>/</span>
                                            <input
                                                type="number"
                                                value={n.maxHp ?? ""}
                                                onChange={(e) => setNPC(n.id, () => ({ maxHp: Number(e.target.value) || 0 }))}
                                                placeholder="max"
                                                style={{ width: 50, textAlign: "right" }}
                                            />
                                            {n.tempHp && n.tempHp > 0 ? (
                                                <span style={{ fontSize: 12, color: "#3b82f6" }}>
      (+{n.tempHp} temp)
    </span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    value={n.tempHp ?? 0}
                                                    onChange={(e) => setNPC(n.id, () => ({ tempHp: Number(e.target.value) || 0 }))}
                                                    placeholder="temp"
                                                    style={{ width: 50, textAlign: "right", color: "#3b82f6" }}
                                                />
                                            )}
                                        </div>

                                        <div>
                                            <button onClick={() => rollFor(n.id)}>Roll</button>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                                        <span>#{idx + 1}</span>
                                        <span>id: {n.id.slice(-6)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                    </div>
            </div>
        </div>
    );
}
