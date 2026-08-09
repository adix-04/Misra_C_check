// const vscode = require("vscode");
// const { analyzeDocument } = require("./diagnostics/misraDiagnostics");

// function activate(context) {

//     const collection =
//         vscode.languages.createDiagnosticCollection("misra");

//     context.subscriptions.push(collection);

//     function update(document) {

//         if (!document) return;

//         if (
//             document.languageId !== "c" &&
//             document.languageId !== "cpp"
//         ) {
//             return;
//         }

//         analyzeDocument(document, collection);
//     }

//     vscode.workspace.onDidOpenTextDocument(update);

//     vscode.workspace.onDidChangeTextDocument(event => {
//         if (event.contentChanges.length === 0) {
//             return;
//         }
//         update(event.document);
        
//     });

//     vscode.window.onDidChangeActiveTextEditor(editor => {
//         if (editor) {
//             update(editor.document);
//         }
//     });

//     if (vscode.window.activeTextEditor) {
//         update(vscode.window.activeTextEditor.document);
//     }
// }

// function deactivate() {}

// module.exports = {
//     activate,
//     deactivate
// };

const vscode = require("vscode");
const {
    analyzeFull,
    handleTextChange,
    runDocumentRules,
    clearDocument
} = require("./diagnostics/misraDiagnostics");

const DEBOUNCE_MS = 800;    // run document-scope rules this long after typing stops
const MAX_WAIT_MS = 10000;  // ...but force a run if it's been this long, even mid-typing

const debounceTimers = new Map(); // uri string -> Timeout
const lastRunAt = new Map();      // uri string -> timestamp

function isMisraLanguage(document) {
    return document.languageId === "c" || document.languageId === "cpp";
}

function scheduleDocumentRules(document, collection) {
    const key = document.uri.toString();
    clearTimeout(debounceTimers.get(key));

    const elapsedSinceLastRun = Date.now() - (lastRunAt.get(key) || 0);
    const wait = elapsedSinceLastRun >= MAX_WAIT_MS ? 0 : DEBOUNCE_MS;

    debounceTimers.set(key, setTimeout(() => {
        lastRunAt.set(key, Date.now());
        runDocumentRules(document, collection);
    }, wait));
}

function activate(context) {

    const collection = vscode.languages.createDiagnosticCollection("misra");
    context.subscriptions.push(collection);

    vscode.workspace.onDidOpenTextDocument(document => {
        if (!isMisraLanguage(document)) return;
        lastRunAt.set(document.uri.toString(), Date.now());
        analyzeFull(document, collection);
    });

    vscode.workspace.onDidChangeTextDocument(event => {
        if (event.contentChanges.length === 0) return;
        if (!isMisraLanguage(event.document)) return;

        handleTextChange(event, collection);              // cheap, runs every keystroke
        scheduleDocumentRules(event.document, collection); // heavy, debounced with a max wait
    });

    vscode.workspace.onDidCloseTextDocument(document => {
        const key = document.uri.toString();
        clearDocument(document.uri);
        clearTimeout(debounceTimers.get(key));
        debounceTimers.delete(key);
        lastRunAt.delete(key);
    });

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && isMisraLanguage(editor.document)) {
            lastRunAt.set(editor.document.uri.toString(), Date.now());
            analyzeFull(editor.document, collection);
        }
    });

    if (vscode.window.activeTextEditor) {
        const document = vscode.window.activeTextEditor.document;
        if (isMisraLanguage(document)) {
            lastRunAt.set(document.uri.toString(), Date.now());
            analyzeFull(document, collection);
        }
    }
}

function deactivate() {
    for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
    }
    debounceTimers.clear();
    lastRunAt.clear();
}

module.exports = {
    activate,
    deactivate
};