const { createDiagnostic } = require("../utils/helper");

const QUALS = new Set(["const", "volatile", "restrict", "_Atomic"]);
const KEYWORD_TYPES = new Set(["signed", "unsigned", "short", "long", "int", "char", "float", "double", "void", "_Bool"]);
const TAG_WORDS = new Set(["struct", "union", "enum"]);
const STORAGE = new Set(["static", "extern", "register", "auto", "inline"]);
const NON_TYPE_WORDS = new Set([
    "return", "else", "case", "goto", "sizeof", "typedef", "if", "while", "for",
    "do", "switch", "default", "break", "continue"
]);
// pointers to these may be freely converted to (the Standard guarantees byte access)
const CHAR_TYPES = new Set(["char", "signed char", "unsigned char", "uint8_t", "int8_t"]);

const tokenRegex = /[A-Za-z_]\w*|\d[\w.]*|->|[^\s]/g;
const isIdent = s => /^[A-Za-z_]/.test(s);

function tokenize(text) {
    const toks = [];
    let m;
    tokenRegex.lastIndex = 0;
    while ((m = tokenRegex.exec(text)) !== null) toks.push({ s: m[0], i: m.index });
    return toks;
}

function lineAndColumn(text, index) {
    const before = text.slice(0, index);
    const line = before.split("\n").length - 1;
    const column = index - before.lastIndexOf("\n") - 1;
    return { line, column };
}

function collectTypedefNames(toks) {
    const names = new Set();
    for (let k = 0; k < toks.length; k++) {
        if (toks[k].s !== "typedef") continue;
        let depth = 0, pdepth = 0, last = null;
        for (let j = k + 1; j < toks.length; j++) {
            const s = toks[j].s;
            if (s === "{") depth++;
            else if (s === "}") depth--;
            else if (s === "(") pdepth++;
            else if (s === ")") pdepth--;
            else if (s === ";" && depth === 0) break;
            else if (depth === 0 && pdepth === 0 && isIdent(s)) last = s;
        }
        if (last) names.add(last);
    }
    return names;
}

function normalizeBase(words) {
    if (words.some(w => TAG_WORDS.has(w))) return words.join(" ");
    const kw = words.filter(w => KEYWORD_TYPES.has(w));
    const other = words.filter(w => !KEYWORD_TYPES.has(w));
    if (other.length) return [...other, ...kw].join(" "); // typedef name
    const has = w => kw.includes(w);
    const longs = kw.filter(w => w === "long").length;
    const uns = has("unsigned");
    if (has("char")) return uns ? "unsigned char" : has("signed") ? "signed char" : "char";
    if (has("short")) return uns ? "unsigned short" : "short";
    if (longs >= 2) return uns ? "unsigned long long" : "long long";
    if (longs === 1) return has("double") ? "long double" : uns ? "unsigned long" : "long";
    if (has("double")) return "double";
    if (has("float")) return "float";
    if (has("void")) return "void";
    if (has("_Bool")) return "_Bool";
    return uns ? "unsigned int" : "int";
}

// words: array of identifier / "*" strings. strict => every word must look like a type word.
function parseType(words, typedefNames, strict) {
    const baseWords = [];
    const baseQuals = new Set();
    const ptrs = [];
    let prev = null;

    for (const w of words) {
        if (w === "*") {
            ptrs.push({ quals: new Set() });
        } else if (QUALS.has(w)) {
            if (ptrs.length) ptrs[ptrs.length - 1].quals.add(w);
            else baseQuals.add(w);
        } else {
            if (ptrs.length) return null;
            const isTagName = prev && TAG_WORDS.has(prev);
            if (strict && !isTagName && !TAG_WORDS.has(w) && !KEYWORD_TYPES.has(w)
                && !w.endsWith("_t") && !typedefNames.has(w)) {
                return null;
            }
            baseWords.push(w);
        }
        prev = w;
    }
    if (baseWords.length === 0) return null;
    return { base: normalizeBase(baseWords), baseQuals, ptrs };
}

// "unqualified pointee type" - drops the qualifiers on the thing pointed to,
// keeps every qualifier deeper inside it.
function pointeeKey(t) {
    const n = t.ptrs.length;
    if (n === 0) return null;
    if (n === 1) return t.base;
    const parts = [...[...t.baseQuals].sort(), t.base];
    for (let k = 0; k < n - 1; k++) {
        const quals = k < n - 2 ? [...t.ptrs[k].quals].sort().join(" ") : "";
        parts.push("*" + quals);
    }
    return parts.join(" ");
}

function typeToString(t) {
    const q = [...t.baseQuals].sort().join(" ");
    const stars = t.ptrs.map(p => "*" + [...p.quals].sort().join(" ")).join(" ");
    return [q, t.base, stars].filter(Boolean).join(" ");
}

const DECL_FOLLOWERS = new Set([";", "=", ",", ")", "["]);
const DECL_PRECEDERS = new Set([";", "{", "}", "(", ","]);

module.exports = {

    id: "11.3",
    scope: "document",
    title: "A cast shall not be performed between a pointer to object type and a pointer to a different object type",

    check(context) {
        const diagnostics = [];
        const text = context.text; // sanitized
        const toks = tokenize(text);
        const typedefNames = collectTypedefNames(toks);
        const vars = new Map(); // name -> { base, baseQuals, ptrs, array }

        for (let k = 0; k < toks.length; k++) {
            const tok = toks[k];

            // ---------- declaration: "<type words / *> name ( ; = , ) [ )" ----------
            if (isIdent(tok.s) && toks[k + 1] && DECL_FOLLOWERS.has(toks[k + 1].s)
                && !KEYWORD_TYPES.has(tok.s) && !NON_TYPE_WORDS.has(tok.s) && !QUALS.has(tok.s)) {

                let j = k - 1;
                while (j >= 0 && (isIdent(toks[j].s) || toks[j].s === "*")) j--;
                const prev = toks[j];
                let seq = toks.slice(j + 1, k).map(t => t.s);

                const plausible = seq.length > 0 && (!prev || DECL_PRECEDERS.has(prev.s))
                    && !seq.some(w => NON_TYPE_WORDS.has(w));
                if (plausible) {
                    seq = seq.filter(w => !STORAGE.has(w));
                    const parsed = parseType(seq, typedefNames, true);
                    if (parsed) {
                        vars.set(tok.s, { ...parsed, array: toks[k + 1].s === "[" });
                    }
                }
            }

            // ---------- cast: "( type words * ) operand" ----------
            if (tok.s !== "(") continue;

            const before = toks[k - 1];
            if (before && isIdent(before.s) && before.s !== "return") continue; // sizeof(...), f(...), if(...)

            let j = k + 1;
            while (j < toks.length && (isIdent(toks[j].s) || toks[j].s === "*")) j++;
            if (!toks[j] || toks[j].s !== ")" || j === k + 1 || toks[j - 1].s !== "*") continue;

            const dst = parseType(toks.slice(k + 1, j).map(t => t.s), typedefNames, false);
            if (!dst) continue;

            let opIdx = j + 1;
            let addr = false;
            if (toks[opIdx] && toks[opIdx].s === "&") { addr = true; opIdx++; }
            const opTok = toks[opIdx];
            if (!opTok || !isIdent(opTok.s) || NON_TYPE_WORDS.has(opTok.s)) continue;
            const afterOp = toks[opIdx + 1];
            if (afterOp && ["(", ".", "->", "["].includes(afterOp.s)) continue; // call / member / element - type unknown

            const v = vars.get(opTok.s);
            if (!v) continue; // never saw its declaration - cannot tell, don't guess

            const src = { base: v.base, baseQuals: v.baseQuals, ptrs: v.ptrs.map(p => ({ quals: new Set(p.quals) })) };
            if (v.array) {
                if (addr) continue; // pointer-to-array - not modelled
                src.ptrs.push({ quals: new Set() }); // array decays to pointer
            } else if (addr) {
                src.ptrs.push({ quals: new Set() });
            }
            if (src.ptrs.length === 0) continue; // integer-to-pointer cast: that's Rule 11.4, not this rule

            // pointers to void are not pointers to object type
            if ((src.ptrs.length === 1 && src.base === "void") || (dst.ptrs.length === 1 && dst.base === "void")) continue;

            if (dst.ptrs.length === 1 && CHAR_TYPES.has(dst.base)) continue; // exception

            if (pointeeKey(src) === pointeeKey(dst)) continue; // only top-level qualifiers differ - compliant

            const { line, column } = lineAndColumn(text, tok.i);
            const span = toks[j].i + 1 - tok.i;
            const sameLine = !text.slice(tok.i, toks[j].i).includes("\n");
            diagnostics.push(
                createDiagnostic(line, column, column + (sameLine ? span : 1), "11.3",
                    `Cast from '${typeToString(src)}' to '${typeToString(dst)}' converts between pointers to different object types`)
            );
        }

        return diagnostics;
    }
};