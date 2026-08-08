const vscode = require("vscode");
const { analyzeDocument } = require("./diagnostics/misraDiagnostics");

function activate(context) {

    const collection =
        vscode.languages.createDiagnosticCollection("misra");

    context.subscriptions.push(collection);

    function update(document) {

        if (!document) return;

        if (
            document.languageId !== "c" &&
            document.languageId !== "cpp"
        ) {
            return;
        }

        analyzeDocument(document, collection);
    }

    vscode.workspace.onDidOpenTextDocument(update);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (event.contentChanges.length === 0) {
            return;
        }
        update(event.document);
        
    });

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            update(editor.document);
        }
    });

    if (vscode.window.activeTextEditor) {
        update(vscode.window.activeTextEditor.document);
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};