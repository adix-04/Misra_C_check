const vscode = require("vscode");

function createDiagnostic(line, start, end, rule, message) {

    const diagnostic = new vscode.Diagnostic(
        new vscode.Range(line, start, line, end),
        `MISRA C Rule ${rule}: ${message}`,
        vscode.DiagnosticSeverity.Warning
    );

    diagnostic.code = rule;
    diagnostic.source = "MISRA C";

    return diagnostic;
}
function createDiagnosticError(line, start, end, rule, message) {

    const diagnostic = new vscode.Diagnostic(
        new vscode.Range(line, start, line, end),
        `MISRA C Rule ${rule}: ${message}`,
        vscode.DiagnosticSeverity.Error
    );

    diagnostic.code = rule;
    diagnostic.source = "MISRA C";

    return diagnostic;
}

module.exports = {
    createDiagnostic,createDiagnosticError
};