import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { get, patch } from "../lib/api";

const STATUS_OPTIONS = [
    "upcoming",
    "ordered",
    "shipped",
    "owned",
    "for_sale",
    "sold",
    "missed",
];

const STATUS_CHIP = {
    upcoming: "bg-amber-100 text-amber-900",
    ordered: "bg-sky-100 text-sky-900",
    shipped: "bg-violet-100 text-violet-900",
    owned: "bg-emerald-100 text-emerald-900",
    for_sale: "bg-fuchsia-100 text-fuchsia-900",
    sold: "bg-zinc-200 text-zinc-700",
    missed: "bg-rose-100 text-rose-900",
};

function Chip({ on, onClick, label, chipClass }) {
    return _jsx("button", {
        onClick: onClick,
        className: [
            "text-xs px-2 py-0.5 border",
            on
                ? chipClass
                    ? `${chipClass} border-transparent`
                    : "border-zinc-900 bg-zinc-900 text-white"
                : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50",
        ].join(" "),
        children: label,
    });
}

export function Library() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState("all");
    const [query, setQuery] = useState("");

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const entries = await get("/library?limit=500");
            const editionIds = Array.from(new Set(entries.map((e) => e.edition_id)));
            const editions = await Promise.all(
                editionIds.map((id) => get(`/editions/${id}`).catch(() => null)),
            );
            const editionById = new Map();
            editionIds.forEach((id, i) => editionById.set(id, editions[i]));
            const workIds = Array.from(
                new Set(editions.filter((e) => !!e).map((e) => e.work_id)),
            );
            const works = await Promise.all(
                workIds.map((id) => get(`/works/${id}`).catch(() => null)),
            );
            const workById = new Map();
            workIds.forEach((id, i) => workById.set(id, works[i]));
            setRows(
                entries.map((entry) => {
                    const edition = editionById.get(entry.edition_id) ?? null;
                    const work = edition ? workById.get(edition.work_id) ?? null : null;
                    return { entry, edition, work };
                }),
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    async function setStatus(entryId, status) {
        setRows((prev) =>
            prev.map((r) =>
                r.entry.id === entryId ? { ...r, entry: { ...r.entry, status } } : r,
            ),
        );
        try {
            await patch(`/library/${entryId}`, { status });
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            void load();
        }
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter((r) => {
            if (filter !== "all" && r.entry.status !== filter) return false;
            if (!q) return true;
            const hay = [
                r.work?.title,
                r.work?.author,
                r.work?.series,
                r.edition?.edition_name,
                r.edition?.publisher_or_shop,
                r.edition?.retailer,
                r.entry.notes,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return hay.includes(q);
        });
    }, [rows, filter, query]);

    const counts = useMemo(() => {
        const c = { all: rows.length };
        for (const s of STATUS_OPTIONS) c[s] = 0;
        for (const r of rows) c[r.entry.status] = (c[r.entry.status] ?? 0) + 1;
        return c;
    }, [rows]);

    return _jsxs("div", {
        children: [
            _jsxs("div", {
                className: "flex items-center justify-between mb-3",
                children: [
                    _jsx("h1", { className: "text-base font-semibold", children: "Library" }),
                    _jsx(Link, {
                        to: "/capture",
                        className: "bg-zinc-900 text-white px-3 py-1 text-sm hover:bg-zinc-700",
                        children: "+ Add edition",
                    }),
                ],
            }),
            _jsxs("div", {
                className: "flex flex-wrap items-center gap-2 mb-3",
                children: [
                    _jsx(Chip, {
                        on: filter === "all",
                        onClick: () => setFilter("all"),
                        label: `All (${counts.all})`,
                    }),
                    ...STATUS_OPTIONS.map((s) =>
                        _jsx(
                            Chip,
                            {
                                on: filter === s,
                                onClick: () => setFilter(s),
                                label: `${s.replace("_", " ")} (${counts[s] ?? 0})`,
                                chipClass: STATUS_CHIP[s],
                            },
                            s,
                        ),
                    ),
                    _jsx("input", {
                        value: query,
                        onChange: (e) => setQuery(e.target.value),
                        placeholder: "Search title, author, shop\u2026",
                        className:
                            "ml-auto border border-zinc-300 bg-white px-2 py-1 text-sm w-64",
                    }),
                ],
            }),
            loading &&
                _jsx("p", { className: "text-sm text-zinc-500", children: "Loading\u2026" }),
            error &&
                _jsx("p", {
                    className:
                        "text-sm text-red-700 border border-red-300 bg-red-50 p-2 mb-3",
                    children: error,
                }),
            !loading && !error && filtered.length === 0 &&
                _jsx("p", {
                    className: "text-sm text-zinc-500",
                    children:
                        rows.length === 0
                            ? "No editions yet. Click Add edition to capture your first."
                            : "Nothing matches that filter.",
                }),
            filtered.length > 0 &&
                _jsx("div", {
                    className:
                        "border border-zinc-300 bg-white divide-y divide-zinc-200",
                    children: filtered.map(({ entry, edition, work }) =>
                        _jsxs(
                            "div",
                            {
                                className:
                                    "px-3 py-2 flex items-center gap-3 hover:bg-zinc-50",
                                children: [
                                    _jsx("div", {
                                        className:
                                            "w-10 h-14 bg-zinc-100 border border-zinc-200 shrink-0 overflow-hidden",
                                        children:
                                            edition?.cover_url &&
                                            _jsx("img", {
                                                src: edition.cover_url,
                                                alt: "",
                                                className: "w-full h-full object-cover",
                                            }),
                                    }),
                                    _jsxs("div", {
                                        className: "flex-1 min-w-0",
                                        children: [
                                            _jsx(Link, {
                                                to: `/editions/${entry.edition_id}`,
                                                className:
                                                    "text-sm font-medium hover:underline",
                                                children: work?.title ?? "Unknown title",
                                            }),
                                            _jsxs("div", {
                                                className: "text-xs text-zinc-600 truncate",
                                                children: [
                                                    edition?.edition_name,
                                                    edition?.publisher_or_shop &&
                                                        ` · ${edition.publisher_or_shop}`,
                                                    work?.author && ` · ${work.author}`,
                                                ],
                                            }),
                                            entry.notes &&
                                                _jsx("div", {
                                                    className:
                                                        "text-xs text-zinc-500 truncate",
                                                    children: entry.notes,
                                                }),
                                        ],
                                    }),
                                    _jsx("div", {
                                        className:
                                            "text-xs text-zinc-600 w-24 text-right tabular-nums",
                                        children: edition?.release_date ?? "",
                                    }),
                                    _jsx("select", {
                                        value: entry.status,
                                        onChange: (e) =>
                                            void setStatus(entry.id, e.target.value),
                                        className: [
                                            "text-xs px-1.5 py-0.5 border border-transparent",
                                            STATUS_CHIP[entry.status],
                                        ].join(" "),
                                        children: STATUS_OPTIONS.map((s) =>
                                            _jsx(
                                                "option",
                                                { value: s, children: s.replace("_", " ") },
                                                s,
                                            ),
                                        ),
                                    }),
                                ],
                            },
                            entry.id,
                        ),
                    ),
                }),
        ],
    });
}
