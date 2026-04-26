import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "../lib/api";

const EMPTY = {
    title: "",
    author: "",
    series: "",
    series_number: "",
    edition_name: "",
    publisher_or_shop: "",
    retailer: "",
    release_date: "",
    isbn: "",
    edition_size: "",
    special_features: "",
    cover_url: "",
    status: "upcoming",
    condition: "",
    purchase_price: "",
    notes: "",
};

const STATUS_OPTIONS = [
    "upcoming",
    "ordered",
    "shipped",
    "owned",
    "for_sale",
    "sold",
    "missed",
];

function nullify(s) {
    const t = (s ?? "").trim();
    return t === "" ? null : t;
}
function intOrNull(s) {
    const t = (s ?? "").trim();
    if (t === "") return null;
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n : null;
}

const INPUT =
    "w-full border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-zinc-900 focus:-outline-offset-1";

export function Capture() {
    const navigate = useNavigate();
    const [form, setForm] = useState(EMPTY);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    async function onSubmit(e) {
        e.preventDefault();
        setError(null);
        if (!form.title.trim()) {
            setError("Title is required.");
            return;
        }
        if (!form.edition_name.trim()) {
            setError("Edition name is required.");
            return;
        }
        setSubmitting(true);
        try {
            const work = await post("/works", {
                title: form.title.trim(),
                author: nullify(form.author),
                series: nullify(form.series),
                series_number: intOrNull(form.series_number),
                base_description: null,
                original_pub_year: null,
            });
            const edition = await post("/editions", {
                work_id: work.id,
                edition_name: form.edition_name.trim(),
                publisher_or_shop: nullify(form.publisher_or_shop),
                retailer: nullify(form.retailer),
                cover_url: nullify(form.cover_url),
                release_date: nullify(form.release_date),
                release_time: null,
                release_timezone: null,
                edition_size: intOrNull(form.edition_size),
                special_features: nullify(form.special_features),
                isbn: nullify(form.isbn),
                preorder_start_at: null,
                preorder_end_at: null,
            });
            const entry = await post("/library", {
                edition_id: edition.id,
                status: form.status,
                condition: nullify(form.condition),
                personal_photo_url: null,
                purchase_price: nullify(form.purchase_price),
                sale_price: null,
                sale_notes: null,
                buyer_info: null,
                notes: nullify(form.notes),
            });
            setForm(EMPTY);
            navigate(`/editions/${entry.edition_id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSubmitting(false);
        }
    }

    function Section({ title, children }) {
        return _jsxs("fieldset", {
            className: "border border-zinc-300 bg-white p-3 space-y-3",
            children: [
                _jsx("legend", {
                    className: "px-1 text-xs uppercase tracking-wide text-zinc-500",
                    children: title,
                }),
                children,
            ],
        });
    }
    function Field({ label, children }) {
        return _jsxs("label", {
            className: "block",
            children: [
                _jsx("span", {
                    className: "block text-xs text-zinc-600 mb-0.5",
                    children: label,
                }),
                children,
            ],
        });
    }

    return _jsxs("div", {
        children: [
            _jsx("h1", { className: "text-base font-semibold mb-3", children: "Capture" }),
            _jsxs("form", {
                onSubmit: onSubmit,
                className: "space-y-6 max-w-2xl",
                children: [
                    _jsxs(Section, {
                        title: "Book",
                        children: [
                            _jsx(Field, {
                                label: "Title *",
                                children: _jsx("input", {
                                    required: true,
                                    value: form.title,
                                    onChange: (e) => set("title", e.target.value),
                                    className: INPUT,
                                }),
                            }),
                            _jsx(Field, {
                                label: "Author",
                                children: _jsx("input", {
                                    value: form.author,
                                    onChange: (e) => set("author", e.target.value),
                                    className: INPUT,
                                }),
                            }),
                            _jsxs("div", {
                                className: "grid grid-cols-3 gap-3",
                                children: [
                                    _jsx("div", {
                                        className: "col-span-2",
                                        children: _jsx(Field, {
                                            label: "Series",
                                            children: _jsx("input", {
                                                value: form.series,
                                                onChange: (e) => set("series", e.target.value),
                                                className: INPUT,
                                            }),
                                        }),
                                    }),
                                    _jsx(Field, {
                                        label: "Series #",
                                        children: _jsx("input", {
                                            value: form.series_number,
                                            onChange: (e) => set("series_number", e.target.value),
                                            inputMode: "numeric",
                                            className: INPUT,
                                        }),
                                    }),
                                ],
                            }),
                        ],
                    }),
                    _jsxs(Section, {
                        title: "Edition",
                        children: [
                            _jsx(Field, {
                                label: "Edition name *",
                                children: _jsx("input", {
                                    required: true,
                                    value: form.edition_name,
                                    onChange: (e) => set("edition_name", e.target.value),
                                    placeholder: "e.g. Illumicrate exclusive",
                                    className: INPUT,
                                }),
                            }),
                            _jsxs("div", {
                                className: "grid grid-cols-2 gap-3",
                                children: [
                                    _jsx(Field, {
                                        label: "Publisher / shop",
                                        children: _jsx("input", {
                                            value: form.publisher_or_shop,
                                            onChange: (e) => set("publisher_or_shop", e.target.value),
                                            className: INPUT,
                                        }),
                                    }),
                                    _jsx(Field, {
                                        label: "Retailer",
                                        children: _jsx("input", {
                                            value: form.retailer,
                                            onChange: (e) => set("retailer", e.target.value),
                                            className: INPUT,
                                        }),
                                    }),
                                ],
                            }),
                            _jsxs("div", {
                                className: "grid grid-cols-2 gap-3",
                                children: [
                                    _jsx(Field, {
                                        label: "Release date",
                                        children: _jsx("input", {
                                            type: "date",
                                            value: form.release_date,
                                            onChange: (e) => set("release_date", e.target.value),
                                            className: INPUT,
                                        }),
                                    }),
                                    _jsx(Field, {
                                        label: "Edition size",
                                        children: _jsx("input", {
                                            value: form.edition_size,
                                            onChange: (e) => set("edition_size", e.target.value),
                                            inputMode: "numeric",
                                            className: INPUT,
                                        }),
                                    }),
                                ],
                            }),
                            _jsx(Field, {
                                label: "ISBN",
                                children: _jsx("input", {
                                    value: form.isbn,
                                    onChange: (e) => set("isbn", e.target.value),
                                    className: INPUT,
                                }),
                            }),
                            _jsx(Field, {
                                label: "Special features",
                                children: _jsx("textarea", {
                                    value: form.special_features,
                                    onChange: (e) => set("special_features", e.target.value),
                                    rows: 2,
                                    className: INPUT,
                                }),
                            }),
                            _jsx(Field, {
                                label: "Cover image URL",
                                children: _jsx("input", {
                                    value: form.cover_url,
                                    onChange: (e) => set("cover_url", e.target.value),
                                    placeholder: "https://\u2026",
                                    className: INPUT,
                                }),
                            }),
                        ],
                    }),
                    _jsxs(Section, {
                        title: "Your copy",
                        children: [
                            _jsx(Field, {
                                label: "Status",
                                children: _jsx("select", {
                                    value: form.status,
                                    onChange: (e) => set("status", e.target.value),
                                    className: INPUT,
                                    children: STATUS_OPTIONS.map((s) =>
                                        _jsx("option", { value: s, children: s.replace("_", " ") }, s),
                                    ),
                                }),
                            }),
                            _jsxs("div", {
                                className: "grid grid-cols-2 gap-3",
                                children: [
                                    _jsx(Field, {
                                        label: "Condition",
                                        children: _jsx("input", {
                                            value: form.condition,
                                            onChange: (e) => set("condition", e.target.value),
                                            placeholder: "e.g. New / Like new",
                                            className: INPUT,
                                        }),
                                    }),
                                    _jsx(Field, {
                                        label: "Purchase price",
                                        children: _jsx("input", {
                                            value: form.purchase_price,
                                            onChange: (e) => set("purchase_price", e.target.value),
                                            inputMode: "decimal",
                                            placeholder: "29.99",
                                            className: INPUT,
                                        }),
                                    }),
                                ],
                            }),
                            _jsx(Field, {
                                label: "Notes",
                                children: _jsx("textarea", {
                                    value: form.notes,
                                    onChange: (e) => set("notes", e.target.value),
                                    rows: 3,
                                    className: INPUT,
                                }),
                            }),
                        ],
                    }),
                    error &&
                        _jsx("p", {
                            className: "text-sm text-red-700 border border-red-300 bg-red-50 p-2",
                            children: error,
                        }),
                    _jsxs("div", {
                        className: "flex items-center gap-2",
                        children: [
                            _jsx("button", {
                                type: "submit",
                                disabled: submitting,
                                className:
                                    "bg-zinc-900 text-white px-3 py-1.5 text-sm hover:bg-zinc-700 disabled:opacity-50",
                                children: submitting ? "Saving\u2026" : "Save edition",
                            }),
                            _jsx("button", {
                                type: "button",
                                onClick: () => setForm(EMPTY),
                                disabled: submitting,
                                className:
                                    "border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100",
                                children: "Clear",
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}
