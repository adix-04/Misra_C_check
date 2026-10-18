const { createDiagnostic } = require("../utils/helper");

// ---- target data model: edit these to match your compiler/target ----
const INT_BITS = 32;
const LONG_BITS = 32; // use 64 for LP64 targets

const BASE_BITS = {
    "char": 8, "signed char": 8, "unsigned char": 8,
    "short": 16, "unsigned short": 16,
    "int": INT_BITS, "unsigned int": INT_BITS,
    "long": LONG_BITS, "unsigned long": LONG_BITS,
    "long long": 64, "unsigned long long": 64,
    "uint8_t": 8, "int8_t": 8, "uint16_t": 16, "int16_t": 16,
    "uint32_t": 32, "int32_t": 32, "uint64_t": 64, "int64_t": 64,
};

const QUALS = new Set(["const", "volatile", "restrict", "_Atomic"]);
const KEYWORD_TYPES = new Set(["signed", "unsigned", "short", "long", "int", "char", "float", "double", "void", "_Bool"]);
const TAG_WORDS = new Set(["struct", "union", "enum"]);
const STORAGE = new Set(["static", "extern", "register", "auto", "inline"]);
const NON_TYPE_WORDS = new Set([
    "return", "else", "case", "goto", "sizeof", "typedef", "if", "while", "for",
    "do", "switch", "default", "break", "continue"
]);

const tokenRegex = /[A-Za-z_]\w*|\d[\w.]*|->|[^\s]/g;
const isIdent = s => /^[A-Za-z_]/.test(s);
const isNumber = s => /^\d/.test(s);

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
    if (other.length) return [...other, ...kw].join(" ");
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

function parseType(words, typedefNames, strict) {
    const baseWords = [];
    let ptrs = 0;
    let prev = null;
    for (const w of words) {
        if (w === "*") ptrs++;
        else if (QUALS.has(w)) { /* qualifiers don't change the width */ }
        else {
            if (ptrs) return null;
            const isTagName = prev && TAG_WORDS.has(prev);
            if (strict && !isTagName && !TAG_WORDS.has(w) && !KEYWORD_TYPES.has(w)
                && !w.endsWith("_t") && !typedefNames.has(w)) return null;
            baseWords.push(w);
        }
        prev = w;
    }
    if (baseWords.length === 0) return null;
    return { base: normalizeBase(baseWords), ptrs };
}

// "42", "0x2A", "052", "1u", "1UL" -> essential width in bits (MISRA 8.10: smallest type that
// holds the value; an L / LL suffix pins it to at least long / long long). null if not an integer.
function literalInfo(s) {
    const m = /^(0[xX][0-9a-fA-F]+|0[0-7]*|[1-9]\d*)([uUlL]*)$/.exec(s);
    if (!m) return null;
    const body = m[1], suffix = m[2].toLowerCase();
    let value;
    if (/^0[xX]/.test(body)) value = parseInt(body, 16);
    else if (body.length > 1 && body[0] === "0") value = parseInt(body, 8);
    else value = parseInt(body, 10);
    const unsigned = suffix.includes("u");
    const longs = (suffix.match(/l/g) || []).length;

    let bits;
    if (unsigned) bits = value <= 0xFF ? 8 : value <= 0xFFFF ? 16 : value <= 0xFFFFFFFF ? 32 : 64;
    else bits = value <= 127 ? 8 : value <= 32767 ? 16 : value <= 2147483647 ? 32 : 64;
    if (longs === 1) bits = Math.max(bits, LONG_BITS);
    if (longs >= 2) bits = 64;
    return { value, bits };
}

function matchBackParen(toks, closeIdx) {
    let depth = 0;
    for (let j = closeIdx; j >= 0; j--) {
        if (toks[j].s === ")") depth++;
        else if (toks[j].s === "(") { depth--; if (depth === 0) return j; }
    }
    return -1;
}

const DECL_FOLLOWERS = new Set([";", "=", ",", ")", "["]);
const DECL_PRECEDERS = new Set([";", "{", "}", "(", ","]);
const HIGHER_BINARY = new Set(["+", "-", "*", "/", "%", "<", ">"]); // "<"/">" here catches an adjacent shift operator
const NON_OPERAND_WORDS = new Set(["return", "case", "else", "do"]);

const endsOperand = t => !!t && ((isIdent(t.s) && !NON_OPERAND_WORDS.has(t.s)) || isNumber(t.s) || t.s === ")" || t.s === "]");

module.exports = {

    id: "12.2",
    scope: "document",
    title: "The right hand operand of a shift operator shall lie in the range zero to one less than the width in bits of the essential type of the left hand operand",

    check(context) {
        const diagnostics = [];
        const text = context.text; // sanitized
        const toks = tokenize(text);
        const typedefNames = collectTypedefNames(toks);
        const vars = new Map(); // name -> { bits|null, skip }

        // width of the left operand ending at toks[opIdx - 1], or null if it cannot be determined
        function leftOperandBits(opIdx) {
            const o = opIdx - 1;
            const T = toks[o];
            if (!T) return null;

            let bits;
            if (isIdent(T.s)) {
                const v = vars.get(T.s);
                if (!v || v.skip) return null;
                bits = v.bits;
            } else if (isNumber(T.s)) {
                const lit = literalInfo(T.s);
                if (!lit) return null;
                bits = lit.bits;
            } else {
                return null; // ")" , "]" etc. - a bigger expression
            }

            let start = o;

            // a cast directly in front of the operand decides the essential type: (uint16_t) x << 9
            if (toks[o - 1] && toks[o - 1].s === ")") {
                const open = matchBackParen(toks, o - 1);
                if (open !== -1) {
                    const words = toks.slice(open + 1, o - 1).map(t => t.s);
                    const castType = words.length ? parseType(words, typedefNames, true) : null;
                    if (castType) {
                        if (castType.ptrs) return null;
                        bits = BASE_BITS[castType.base] || null;
                        start = open;
                    }
                }
            }
            if (bits == null) return null;

            // is the operand the WHOLE left operand? "a + b << 2" and "a << 2 << 3" are not
            const prev = toks[start - 1];
            if (prev) {
                if (prev.s === "." || prev.s === "->") return null;
                if (HIGHER_BINARY.has(prev.s)) {
                    const unary = (prev.s === "+" || prev.s === "-" || prev.s === "*") && !endsOperand(toks[start - 2]);
                    if (!unary || prev.s === "*") return null; // binary operator, or pointer dereference
                }
                if (prev.s === "&" && !endsOperand(toks[start - 2])) return null; // address-of
                if (prev.s === "!") return null;
            }
            return bits;
        }

        for (let k = 0; k < toks.length; k++) {
            const tok = toks[k];

            // ---------- declaration: records the width of each declared object ----------
            if (isIdent(tok.s) && toks[k + 1] && DECL_FOLLOWERS.has(toks[k + 1].s)
                && !KEYWORD_TYPES.has(tok.s) && !NON_TYPE_WORDS.has(tok.s) && !QUALS.has(tok.s)) {

                let j = k - 1;
                while (j >= 0 && (isIdent(toks[j].s) || toks[j].s === "*")) j--;
                const prev = toks[j];
                let seq = toks.slice(j + 1, k).map(t => t.s);

                if (seq.length > 0 && (!prev || DECL_PRECEDERS.has(prev.s)) && !seq.some(w => NON_TYPE_WORDS.has(w))) {
                    seq = seq.filter(w => !STORAGE.has(w));
                    const parsed = parseType(seq, typedefNames, true);
                    if (parsed) {
                        vars.set(tok.s, {
                            bits: BASE_BITS[parsed.base] || null,
                            skip: parsed.ptrs > 0 || toks[k + 1].s === "[",
                        });
                    }
                }
            }

            // ---------- shift operator: "<<", ">>", "<<=", ">>=" ----------
            if (!((tok.s === "<" || tok.s === ">") && toks[k + 1] && toks[k + 1].s === tok.s && toks[k + 1].i === tok.i + 1)) continue;
            if (toks[k - 1] && toks[k - 1].s === tok.s && toks[k - 1].i === tok.i - 1) continue; // middle of "<<<" - not C
            let rightStart = k + 2;
            if (toks[k + 2] && toks[k + 2].s === "=" && toks[k + 2].i === toks[k + 1].i + 1) rightStart = k + 3;

            // ---- right operand must be an integer constant (optionally signed / parenthesised) ----
            let p = rightStart, open = 0;
            while (toks[p] && toks[p].s === "(") { open++; p++; }
            let sign = "";
            if (toks[p] && (toks[p].s === "-" || toks[p].s === "+")) { sign = toks[p].s; p++; }
            const numTok = toks[p];
            if (!numTok || !isNumber(numTok.s)) continue; // non-constant count - undecidable here
            const lit = literalInfo(numTok.s);
            if (!lit) continue;
            let q = p + 1;
            let closed = 0;
            while (closed < open && toks[q] && toks[q].s === ")") { closed++; q++; }
            if (closed !== open) continue;
            const after = toks[q];
            if (after && ["+", "-", "*", "/", "%", "(", "[", "."].includes(after.s)) continue; // "<< 8 - n": count is a larger expression

            const count = sign === "-" ? -lit.value : lit.value;

            // ---- left operand width ----
            const width = leftOperandBits(k);
            if (width == null) continue;

            if (count < 0 || count >= width) {
                const startTok = sign ? toks[p - 1] : numTok;
                const startIdx = startTok.i;
                const endIdx = numTok.i + numTok.s.length;
                const { line, column } = lineAndColumn(text, startIdx);
                diagnostics.push(
                    createDiagnostic(line, column, column + (endIdx - startIdx), "12.2",
                        count < 0
                            ? `Shift count ${count} is negative (valid range is 0 to ${width - 1})`
                            : `Shift count ${count} is out of range for ${width === 8 ? "an" : "a"} ${width}-bit left operand (valid range is 0 to ${width - 1})`)
                );
            }
        }

        return diagnostics;
    }
};