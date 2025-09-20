// src/storage.ts
export type NPC = {
    id: string;
    name: string;
    description: string;
    mod: number;
    initiative: number | null;
    createdAt: number;
};

export type SaveFile = {
    version: 1;
    exportedAt: number;
    npcs: NPC[];
};

export const STORAGE_KEY = "initiative-tracker-npcs-v1";

export function saveToLocal(npcs: NPC[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(npcs));
}

export function loadFromLocal(): NPC[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// Export a download (characters.json)
export function exportToFile(npcs: NPC[], filename = "characters.json") {
    const payload: SaveFile = {
        version: 1,
        exportedAt: Date.now(),
        npcs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Read file input -> Promise<NPC[]>
export function importFromFile(file: File, cap = 100): Promise<NPC[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.onload = () => {
            try {
                const text = String(reader.result ?? "");
                const parsed = JSON.parse(text);
                // accept both raw array or versioned { version, npcs }
                const npcs: NPC[] = Array.isArray(parsed)
                    ? parsed
                    : (parsed?.npcs ?? []);
                if (!Array.isArray(npcs)) throw new Error("Invalid file format");

                const cleaned = npcs.slice(0, cap).map((n) => ({
                    id:
                        n.id ||
                        `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    name: String(n.name ?? "Unnamed"),
                    description: String(n.description ?? ""),
                    mod: Number(n.mod ?? 0) || 0,
                    initiative:
                        n.initiative == null ? null : Number(n.initiative) || 0,
                    createdAt: Number(n.createdAt ?? Date.now()),
                }));
                resolve(cleaned);
            } catch (e: any) {
                reject(new Error(e?.message || "Invalid JSON"));
            }
        };
        reader.readAsText(file);
    });
}
