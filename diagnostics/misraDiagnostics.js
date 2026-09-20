
// // const { lineRules, documentRules } = require("../rules");

// // // per-document state, keyed by uri string
// // const docState = new Map();

// // function getState(uri) {
// //     const key = uri.toString();
// //     let state = docState.get(key);
// //     if (!state) {
// //         state = {
// //             lineDiagnostics: new Map(), // lineNumber -> Diagnostic[]
// //             documentDiagnostics: [],
// //             lastDocVersion: -1
// //         };
// //         docState.set(key, state);
// //     }
// //     return state;
// // }

// // function scanLine(line, lineNumber) {
// //     const diags = [];
// //     for (const rule of lineRules) {
// //         const result = rule.checkLine(line, lineNumber);
// //         if (!result) continue;
// //         if (Array.isArray(result)) diags.push(...result);
// //         else diags.push(result);
// //     }
// //     return diags;
// // }

// // function publish(document, collection) {
// //     const state = getState(document.uri);
// //     const all = [];
// //     for (const diags of state.lineDiagnostics.values()) all.push(...diags);
// //     all.push(...state.documentDiagnostics);
// //     collection.set(document.uri, all);
// // }

// // function shiftLineDiagnostics(state, startLine, endLine, delta) {
// //     if (delta === 0) return;
// //     const shifted = new Map();
// //     for (const [lineNumber, diags] of state.lineDiagnostics) {
// //         if (lineNumber < startLine) {
// //             shifted.set(lineNumber, diags);
// //         } else if (lineNumber > endLine) {
// //             shifted.set(lineNumber + delta, diags);
// //         }
// //         // lines inside [startLine, endLine] are dropped on purpose —
// //         // they get rescanned right after this runs
// //     }
// //     state.lineDiagnostics = shifted;
// // }

// // function analyzeFull(document, collection) {
// //     const lines = document.getText().split("\n");
// //     const state = getState(document.uri);

// //     state.lineDiagnostics.clear();
// //     for (let i = 0; i < lines.length; i++) {
// //         const diags = scanLine(lines[i], i);
// //         if (diags.length) state.lineDiagnostics.set(i, diags);
// //     }

// //     runDocumentRules(document, collection, { force: true });
// //     publish(document, collection);
// // }

// // function handleTextChange(event, collection) {
// //     const document = event.document;
// //     const state = getState(document.uri);
// //     const changedLines = new Set();

// //     for (const change of event.contentChanges) {
// //         const startLine = change.range.start.line;
// //         const endLine = change.range.end.line;
// //         const linesRemoved = endLine - startLine;
// //         const linesAdded = change.text.split("\n").length - 1;
// //         const delta = linesAdded - linesRemoved;

// //         shiftLineDiagnostics(state, startLine, endLine, delta);

// //         for (let i = startLine; i <= startLine + linesAdded; i++) {
// //             changedLines.add(i);
// //         }
// //     }

// //     for (const lineNumber of changedLines) {
// //         if (lineNumber < 0 || lineNumber >= document.lineCount) {
// //             state.lineDiagnostics.delete(lineNumber);
// //             continue;
// //         }
// //         const text = document.lineAt(lineNumber).text;
// //         const diags = scanLine(text, lineNumber);
// //         if (diags.length) state.lineDiagnostics.set(lineNumber, diags);
// //         else state.lineDiagnostics.delete(lineNumber);
// //     }

// //     publish(document, collection);
// // }

// // function runDocumentRules(document, collection, { force = false } = {}) {
// //     const state = getState(document.uri);
// //     if (!force && document.version === state.lastDocVersion) return;
// //     state.lastDocVersion = document.version;

// //     const context = {
// //         document,
// //         text: document.getText(),
// //         lines: document.getText().split("\n")
// //     };

// //     const diagnostics = [];
// //     for (const rule of documentRules) {
// //         diagnostics.push(...rule.check(context));
// //     }
// //     state.documentDiagnostics = diagnostics;

// //     publish(document, collection);
// // }

// // function clearDocument(uri) {
// //     docState.delete(uri.toString());
// // }

// // module.exports = {
// //     analyzeFull,
// //     handleTextChange,
// //     runDocumentRules,
// //     clearDocument
// // };


// const vscode = require("vscode");
// const { lineRules, documentRules } = require("../rules");

// const docState = new Map();

// function getState(uri) {
//     const key = uri.toString();
//     let state = docState.get(key);
//     if (!state) {
//         state = {
//             lineDiagnostics: new Map(),
//             documentDiagnostics: [],
//             lastDocVersion: -1
//         };
//         docState.set(key, state);
//     }
//     return state;
// }

// function scanLine(line, lineNumber) {
//     const diags = [];
//     for (const rule of lineRules) {
//         const result = rule.checkLine(line, lineNumber);
//         if (!result) continue;
//         if (Array.isArray(result)) diags.push(...result);
//         else diags.push(result);
//     }
//     return diags;
// }

// function publish(document, collection) {
//     const state = getState(document.uri);
//     const all = [];
//     for (const diags of state.lineDiagnostics.values()) all.push(...diags);
//     all.push(...state.documentDiagnostics);
//     collection.set(document.uri, all);
// }

// // rebuilds a diagnostic with its Range moved by `delta` lines —
// // the actual fix. Without this, the Map key moves but the squiggle doesn't.
// function shiftDiagnostic(diagnostic, delta) {
//     const oldRange = diagnostic.range;
//     const newRange = new vscode.Range(
//         oldRange.start.line + delta,
//         oldRange.start.character,
//         oldRange.end.line + delta,
//         oldRange.end.character
//     );

//     const shifted = new vscode.Diagnostic(newRange, diagnostic.message, diagnostic.severity);
//     shifted.code = diagnostic.code;
//     shifted.source = diagnostic.source;
//     if (diagnostic.tags) shifted.tags = diagnostic.tags;
//     if (diagnostic.relatedInformation) shifted.relatedInformation = diagnostic.relatedInformation;
//     return shifted;
// }

// function shiftLineDiagnostics(state, startLine, endLine, delta) {
//     if (delta === 0) return;
//     const shifted = new Map();
//     for (const [lineNumber, diags] of state.lineDiagnostics) {
//         if (lineNumber < startLine) {
//             shifted.set(lineNumber, diags);
//         } else if (lineNumber > endLine) {
//             shifted.set(lineNumber + delta, diags.map(d => shiftDiagnostic(d, delta)));
//         }
//         // lines inside [startLine, endLine] are dropped - rescanned right after
//     }
//     state.lineDiagnostics = shifted;
// }

// function analyzeFull(document, collection) {
//     const lines = document.getText().split("\n");
//     const state = getState(document.uri);

//     state.lineDiagnostics.clear();
//     for (let i = 0; i < lines.length; i++) {
//         const diags = scanLine(lines[i], i);
//         if (diags.length) state.lineDiagnostics.set(i, diags);
//     }

//     runDocumentRules(document, collection, { force: true });
//     publish(document, collection);
// }

// function handleTextChange(event, collection) {
//     const document = event.document;
//     const state = getState(document.uri);
//     const changedLines = new Set();

//     for (const change of event.contentChanges) {
//         const startLine = change.range.start.line;
//         const endLine = change.range.end.line;
//         const linesRemoved = endLine - startLine;
//         const linesAdded = change.text.split("\n").length - 1;
//         const delta = linesAdded - linesRemoved;

//         shiftLineDiagnostics(state, startLine, endLine, delta);

//         for (let i = startLine; i <= startLine + linesAdded; i++) {
//             changedLines.add(i);
//         }
//     }

//     for (const lineNumber of changedLines) {
//         if (lineNumber < 0 || lineNumber >= document.lineCount) {
//             state.lineDiagnostics.delete(lineNumber);
//             continue;
//         }
//         const text = document.lineAt(lineNumber).text;
//         const diags = scanLine(text, lineNumber);
//         if (diags.length) state.lineDiagnostics.set(lineNumber, diags);
//         else state.lineDiagnostics.delete(lineNumber);
//     }

//     publish(document, collection);
// }

// function runDocumentRules(document, collection, { force = false } = {}) {
//     const state = getState(document.uri);
//     if (!force && document.version === state.lastDocVersion) return;
//     state.lastDocVersion = document.version;

//     const context = {
//         document,
//         text: document.getText(),
//         lines: document.getText().split("\n")
//     };

//     const diagnostics = [];
//     for (const rule of documentRules) {
//         diagnostics.push(...rule.check(context));
//     }
//     state.documentDiagnostics = diagnostics;

//     publish(document, collection);
// }

// function clearDocument(uri) {
//     docState.delete(uri.toString());
// }

// module.exports = {
//     analyzeFull,
//     handleTextChange,
//     runDocumentRules,
//     clearDocument
// };

const { lineRules, documentRules } = require("../rules");
const { sanitizeLine, sanitizeText } = require("../utils/sanitize");

const docState = new Map();

function getState(uri) {
    const key = uri.toString();
    let state = docState.get(key);
    if (!state) {
        state = {
            lineDiagnostics: new Map(),
            documentDiagnostics: [],
            lastDocVersion: -1
        };
        docState.set(key, state);
    }
    return state;
}

function scanLine(rawLine, lineNumber) {
    const line = sanitizeLine(rawLine); // <-- new: blank comments/strings before rules see it
    const diags = [];
    for (const rule of lineRules) {
        const result = rule.checkLine(line, lineNumber);
        if (!result) continue;
        if (Array.isArray(result)) diags.push(...result);
        else diags.push(result);
    }
    return diags;
}

function publish(document, collection) {
    const state = getState(document.uri);
    const all = [];
    for (const diags of state.lineDiagnostics.values()) all.push(...diags);
    all.push(...state.documentDiagnostics);
    collection.set(document.uri, all);
}

function shiftLineDiagnostics(state, startLine, endLine, delta) {
    if (delta === 0) return;
    const shifted = new Map();
    for (const [lineNumber, diags] of state.lineDiagnostics) {
        if (lineNumber < startLine) {
            shifted.set(lineNumber, diags);
        } else if (lineNumber > endLine) {
            shifted.set(lineNumber + delta, diags.map(d => shiftDiagnostic(d, delta)));
        }
    }
    state.lineDiagnostics = shifted;
}

function shiftDiagnostic(diagnostic, delta) {
    const vscode = require("vscode");
    const oldRange = diagnostic.range;
    const newRange = new vscode.Range(
        oldRange.start.line + delta, oldRange.start.character,
        oldRange.end.line + delta, oldRange.end.character
    );
    const shifted = new vscode.Diagnostic(newRange, diagnostic.message, diagnostic.severity);
    shifted.code = diagnostic.code;
    shifted.source = diagnostic.source;
    if (diagnostic.tags) shifted.tags = diagnostic.tags;
    if (diagnostic.relatedInformation) shifted.relatedInformation = diagnostic.relatedInformation;
    return shifted;
}

function analyzeFull(document, collection) {
    const rawText = document.getText();
    const sanitizedLines = sanitizeText(rawText).split("\n");
    const state = getState(document.uri);

    state.lineDiagnostics.clear();
    for (let i = 0; i < sanitizedLines.length; i++) {
        const diags = [];
        for (const rule of lineRules) {
            const result = rule.checkLine(sanitizedLines[i], i);
            if (result) Array.isArray(result) ? diags.push(...result) : diags.push(result);
        }
        if (diags.length) state.lineDiagnostics.set(i, diags);
    }

    runDocumentRules(document, collection, { force: true });
    publish(document, collection);
}

function handleTextChange(event, collection) {
    const document = event.document;
    const state = getState(document.uri);
    const changedLines = new Set();

    for (const change of event.contentChanges) {
        const startLine = change.range.start.line;
        const endLine = change.range.end.line;
        const linesRemoved = endLine - startLine;
        const linesAdded = change.text.split("\n").length - 1;
        const delta = linesAdded - linesRemoved;

        shiftLineDiagnostics(state, startLine, endLine, delta);

        for (let i = startLine; i <= startLine + linesAdded; i++) {
            changedLines.add(i);
        }
    }

    for (const lineNumber of changedLines) {
        if (lineNumber < 0 || lineNumber >= document.lineCount) {
            state.lineDiagnostics.delete(lineNumber);
            continue;
        }
        const rawLine = document.lineAt(lineNumber).text;
        const diags = scanLine(rawLine, lineNumber); // sanitizes internally now
        if (diags.length) state.lineDiagnostics.set(lineNumber, diags);
        else state.lineDiagnostics.delete(lineNumber);
    }

    publish(document, collection);
}

function runDocumentRules(document, collection, { force = false } = {}) {
    const state = getState(document.uri);
    if (!force && document.version === state.lastDocVersion) return;
    state.lastDocVersion = document.version;

    const rawText = document.getText();
    const sanitized = sanitizeText(rawText);

    const context = {
        document,
        text: sanitized,               // <-- sanitized: what every existing document rule uses
        lines: sanitized.split("\n"),
        rawText: rawText,              // <-- raw: only Rule3_1 needs this
        rawLines: rawText.split("\n")
    };

    const diagnostics = [];
    for (const rule of documentRules) {
        diagnostics.push(...rule.check(context));
    }
    state.documentDiagnostics = diagnostics;

    publish(document, collection);
}

function clearDocument(uri) {
    docState.delete(uri.toString());
}

module.exports = {
    analyzeFull,
    handleTextChange,
    runDocumentRules,
    clearDocument
};