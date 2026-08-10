const { createDiagnostic } = require("../utils/helper");

module.exports = {

    id: "3.2",
    scope: "line",
    title: "Line splicing shall not be used in // comments",

    checkLine(line, lineNumber) {
        const commentIndex = line.indexOf("//");
        if (commentIndex === -1) return null;

        const commentText = line.slice(commentIndex + 2);
        const trimmed = commentText.trimEnd();

        if (!trimmed.endsWith("\\")) return null;

        const col = line.lastIndexOf("\\");

        return createDiagnostic(
            lineNumber,
            col,
            col + 1,
            "3.2",
            "Line splicing (\\) is not allowed in // comments"
        );
    }
};