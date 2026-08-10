const { createDiagnostic } = require("../utils/helper");

// matches: [ static <anything> ] — e.g. "[ static 20 ]", "[static 20]", "[ static n ]"
const staticInArrayParam = /\[\s*static\b[^\]]*\]/;

module.exports = {

    id: "17.6",
    scope: "line",
    title: "The declaration of an array parameter shall not contain the static keyword between the [ ]",

    checkLine(line, lineNumber) {
        const match = staticInArrayParam.exec(line);
        if (!match) return null;

        return createDiagnostic(
            lineNumber,
            match.index,
            match.index + match[0].length,
            "17.6",
            "Array parameter declaration shall not use 'static' between [ ]"
        );
    }
};