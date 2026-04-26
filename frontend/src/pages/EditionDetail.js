import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

function Row({ label, value }) {
    return _jsxs("div", {
        className: "px-3 py-1.5 flex text-sm",
        children: [
            _jsx("dt", { className: "w-40 text-zinc-500 shrink-0", children: label }),
            _jsx("dd", {
                className: "flex-1",
                children:
                    value || _jsx("span", { className: "text-zinc-400", children: "\u2014" }),
            }),
        ],
    });
}

export function EditionDetail() {
    const { id } = useParams();
    const [edition, setEdition] = useState(null);
    const [work, setWork] = useState(null);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const entry = entries[0] ?? null;
    const [notes, setNotes] = useState("");
    const [savingNotes, setSavingNotes] = useState(false);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const ed = await get(`/editions/${id}`);
                if (cancelled) return;
                setEdition(ed);
                const [wk, libs] = await Promise.all([
                    get(`/works/${ed.work_id}`).catch(() => null),
                    get(`/library?edition_id=${id}`).catch(() => []),
                ]);
                if (cancelled) return;
                setWork(wk);
                setEntries(libs);
                setNotes(libs[0]?.notes ?? "");
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : String(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    async function setStatus(s) {
        if (!entry) return;
        setEntries((prev) => prev.map((e) => ({ ...e, status: s })));
        try {
            await patch(`/library/${entry.id}`, { status: s });
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }

    async function saveNotes() {
        if (!entry) return;
        setSavingNotes(true);
        try {
            const updated = await patch(`/library/${entry.id}`, {
                notes: notes.trim() === "" ? null : notes,
            });
            setEntries([updated, ...entries.slice(1)]);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSavingNotes(false);
        }
    }

    const meta = useMemo(() => {
        if (!edition) return [];
        return [
            ["Edition", edition.edition_name],
            ["Publisher / shop", edition.publisher_or_shop],
            ["Retailer", edition.retailer],
            ["Release date", edition.release_date],
            ["Edition size", edition.edition_size?.toString() ?? null],
            ["ISBN", edition.isbn],
            ["Special features", edition.special_features],
        ];
    }, [edition]);

    if (loading && !edition) {
        return _jsx("p", { className: "text-sm text-zinc-500", children: "Loading\u2026" });
    }
    if (error && !edition) {
        return _jsx("p", {
            className: "text-sm text-red-700 border border-red-300 bg-red-50 p-2",
            children: error,
        });
    }
    if (!edition) {
        return _jsx("p", { className: "text-sm text-zinc-500", children: "Not found." });
    }

    return _jsxs("div", {
        className: "space-y-4",
        children: [
            _jsx("div", {
                className: "text-xs",
                children: _jsx(Link, {
                    to: "/library",
                    className: "text-zinc-600 hover:underline",
                    children: "\u2190 Back to library",
                }),
            }),
            _jsxs("div", {
                className: "flex gap-4",
                children: [
                    _jsx("div", {
                        className:
                            "w-32 h-44 bg-zinc-100 border border-zinc-300 shrink-0 overflow-hidden",
                        children:
                            edition.cover_url &&
                            _jsx("img", {
                                src: edition.cover_url,
                                alt: "",
                                className: "w-full h-full object-cover",
                            }),
                    }),
                    _jsxs("div", {
                        className: "flex-1 min-w-0",
                        children: [
                            _jsx("h1", {
                                className: "text-lg font-semibold",
                                children: work?.title ?? "Untitled",
                            }),
                            work?.author &&
                                _jsx("p", {
                                    className: "text-sm text-zinc-600",
                                    children: work.author,
                                }),
                            work?.series &&
                                _jsxs("p", {
                                    className: "text-xs text-zinc-500",
                                    children: [
                                        work.series,
                                        work.series_number != null &&
                                            ` #${work.series_number}`,
                                    ],
                                }),
                            entry &&
                                _jsxs("div", {
                                    className: "mt-3 flex items-center gap-2",
                                    children: [
                                        _jsx("span", {
                                            className: "text-xs text-zinc-500",
                                            children: "Status:",
                                        }),
                                        _jsx("select", {
                                            value: entry.status,
                                            onChange: (e) => void setStatus(e.target.value),
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
                                }),
                        ],
                    }),
                ],
            }),
            error &&
                _jsx("p", {
                    className: "text-sm text-red-700 border border-red-300 bg-red-50 p-2",
                    children: error,
                }),
            _jsxs("div", {
                className: "border border-zinc-300 bg-white",
                children: [
                    _jsx("div", {
                        className:
                            "px-3 py-2 border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500",
                        children: "Edition details",
                    }),
                    _jsx("dl", {
                        className: "divide-y divide-zinc-100",
                        children: meta.map(([k, v]) =>
                            _jsxs(
                                "div",
                                {
                                    className: "px-3 py-1.5 flex text-sm",
                                    children: [
                                        _jsx("dt", {
                                            className: "w-40 text-zinc-500 shrink-0",
                                            children: k,
                                        }),
                                        _jsx("dd", {
                                            className: "flex-1",
                                            children:
                                                v ||
                                                _jsx("span", {
                                                    className: "text-zinc-400",
                                                    children: "\u2014",
                                                }),
                                        }),
                                    ],
                                },
                                k,
                            ),
                        ),
                    }),
                ],
            }),
            entry &&
                _jsxs("div", {
                    className: "border border-zinc-300 bg-white",
                    children: [
                        _jsx("div", {
                            className:
                                "px-3 py-2 border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500",
                            children: "Your copy",
                        }),
                        _jsxs("dl", {
                            className: "divide-y divide-zinc-100",
                            children: [
                                _jsx(Row, { label: "Condition", value: entry.condition }),
                                _jsx(Row, {
                                    label: "Purchase price",
                                    value: entry.purchase_price,
                                }),
                                _jsx(Row, { label: "Sale price", value: entry.sale_price }),
                                _jsx(Row, {
                                    label: "Status changed",
                                    value: new Date(entry.status_changed_at).toLocaleString(),
                                }),
                            ],
                        }),
                        _jsxs("div", {
                            className: "px-3 py-2 border-t border-zinc-200",
                            children: [
                                _jsx("label", {
                                    className: "block text-xs text-zinc-500 mb-1",
                                    children: "Notes",
                                }),
                                _jsx("textarea", {
                                    value: notes,
                                    onChange: (e) => setNotes(e.target.value),
                                    rows: 3,
                                    className:
                                        "w-full border border-zinc-300 bg-white px-2 py-1.5 text-sm",
                                }),
                                _jsx("div", {
                                    className: "mt-2",
                                    children: _jsx("button", {
                                        onClick: () => void saveNotes(),
                                        disabled:
                                            savingNotes || notes === (entry.notes ?? ""),
                                        className:
                                            "bg-zinc-900 text-white px-3 py-1 text-sm hover:bg-zinc-700 disabled:opacity-50",
                                        children: savingNotes ? "Saving\u2026" : "Save notes",
                                    }),
                                }),
                            ],
                        }),
                    ],
                }),
        ],
    });
}
