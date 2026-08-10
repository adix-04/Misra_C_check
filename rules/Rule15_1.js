const { createDiagnostic } = require("../utils/helper");

module.exports = {

    id: "15.1",
    scope: "line",

    checkLine(line, lineNumber) {
        const index = line.indexOf("goto");
        if (index === -1) return null;

        return createDiagnostic(
            lineNumber,
            index,
            index + 4,
            "15.1",
            "The goto <label>; statement shall not be used."
        );
    }
};