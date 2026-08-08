const rules = require("../rules");

function analyzeDocument(document, collection) {

    const context = {
    document,
    text: document.getText(),
    lines: document.getText().split("\n")
};
    let diagnostics = [];   // ✅ MUST exist here
    for (const rule of rules) {
        const result = rule.check(context);
        diagnostics.push(...result);
    }

    collection.set(document.uri, diagnostics);
}

module.exports = {
    analyzeDocument
};